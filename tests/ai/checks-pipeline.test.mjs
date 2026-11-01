/**
 * Integration tests for the two output checks, through the real pipeline.
 *
 * These are the behaviours the checks exist for, asserted end to end rather than
 * on the detector in isolation: a wrong-language response is rewritten once, and a
 * second failure ends in a clean error rather than a loop or a leaked message.
 *
 * Run with: node --test tests/ai/checks-pipeline.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { generate } = await import("../../build-test/generate.mjs");
const { getTool } = await import("../../build-test/tools.mjs");

function capturingLogger() {
  const lines = [];
  return {
    lines,
    warn(fields) {
      lines.push(JSON.stringify(fields));
    },
    text() {
      return lines.join("\n");
    },
  };
}

function scriptedGenerator(responses) {
  const calls = [];
  return {
    calls,
    async generate(args) {
      calls.push(args);
      const next = responses[calls.length - 1];
      if (next === undefined) throw new Error("provider called more times than the script allows");
      if (next instanceof Error) throw next;
      return { text: next, truncated: false };
    },
  };
}

const openLimiter = { check: () => ({ allowed: true }) };

const ENGLISH_PLAN = JSON.stringify({
  title: "Dividing fractions",
  objectives: ["Explain what dividing by a fraction means", "Solve simple division problems"],
  materials: ["Whiteboard", "Worksheets"],
  stages: [
    { name: "Warm-up", minutes: 5, description: "Review the previous lesson with the class" },
    { name: "Instruction", minutes: 30, description: "Explain the concept and work through examples" },
  ],
  assessment: "A short exit question at the end of the lesson",
  homework: "Five problems from the worksheet",
});

const ARABIC_PLAN = JSON.stringify({
  title: "قسمة الكسور",
  objectives: ["أن يفهم الطالب معنى قسمة الكسور", "أن يحل الطالب مسائل بسيطة على القسمة"],
  materials: ["سبورة", "أوراق عمل"],
  stages: [
    { name: "تمهيد", minutes: 5, description: "مراجعة سريعة لدرس الضرب مع الطلاب في الصف" },
    { name: "شرح", minutes: 30, description: "يشرح المعلم المفهوم ثم يعمل الطلاب في مجموعات صغيرة" },
  ],
  assessment: "سؤال قصير في نهاية الحصة للتأكد من فهم الطلاب",
  homework: "خمس مسائل من ورقة العمل",
});

const baseArgs = (overrides = {}) => ({
  toolId: "lesson-plan",
  options: {
    outputLanguage: "ar",
    grade: "8",
    subject: "math",
    duration: "45",
    teachingStyles: ["inquiry"],
  },
  userId: "user-1",
  limiter: openLimiter,
  logger: capturingLogger(),
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/* Language: the repair path                                                  */
/* -------------------------------------------------------------------------- */

test("language: a wrong-language response triggers exactly one repair, then succeeds", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN, ARABIC_PLAN]);
  const logger = capturingLogger();

  const result = await generate(baseArgs({ generator, logger }));

  assert.equal(result.ok, true, "the rewrite succeeds");
  assert.equal(result.meta.attempts, 2, "exactly one retry");
  assert.equal(generator.calls.length, 2);
  assert.match(logger.text(), /language_retry/);
});

test("language: the repair prompt asks for a rewrite, not a structure fix", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN, ARABIC_PLAN]);
  await generate(baseArgs({ generator }));

  const repair = generator.calls[1].user;
  assert.match(repair, /wrong language/);
  assert.match(repair, /Arabic/);
  assert.match(repair, /change only the language of the prose/);
  // It must not tell the model its structure was wrong — it was not.
  assert.equal(/Fix ONLY the structural problems/.test(repair), false);
});

test("language: the repair prompt carries the measurement, never the text", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN, ARABIC_PLAN]);
  await generate(baseArgs({ generator }));

  const repair = generator.calls[1].user;
  assert.match(repair, /%/, "the ratio is reported");
  // No generated prose is quoted back at the model.
  for (const phrase of ["Dividing fractions", "Whiteboard", "Worksheets", "Warm-up"]) {
    assert.equal(repair.includes(phrase), false, `generated content leaked into the repair prompt: ${phrase}`);
  }
});

test("language: a second wrong-language response fails cleanly with 502", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN, ENGLISH_PLAN]);
  const logger = capturingLogger();

  const result = await generate(baseArgs({ generator, logger }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "ai_output_invalid");
  assert.equal(result.status, 502);
  assert.equal(generator.calls.length, 2, "one repair, no more");
});

test("language: only one language retry is ever attempted", async () => {
  // Three wrong responses available; the pipeline must stop after the second.
  const generator = scriptedGenerator([ENGLISH_PLAN, ENGLISH_PLAN, ENGLISH_PLAN]);
  await generate(baseArgs({ generator }));
  assert.equal(generator.calls.length, 2);
});

test("language: a correct-language response is not retried", async () => {
  const generator = scriptedGenerator([ARABIC_PLAN]);
  const result = await generate(baseArgs({ generator }));
  assert.equal(result.ok, true);
  assert.equal(result.meta.attempts, 1);
});

test("language: English requested and English returned passes", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN]);
  const result = await generate(
    baseArgs({
      generator,
      options: {
        outputLanguage: "en",
        grade: "8",
        subject: "math",
        duration: "45",
        teachingStyles: ["inquiry"],
      },
    }),
  );
  assert.equal(result.ok, true);
});

test("language: a numbers-only response is not punished as a mismatch", async () => {
  // Undecidable content must pass through, not cost a second provider call.
  const numeric = JSON.stringify({
    title: "1/2 + 1/4",
    objectives: ["1 + 1 = 2", "2 x 3 = 6"],
    materials: ["1", "2"],
    stages: [
      { name: "1", minutes: 5, description: "1 + 1" },
      { name: "2", minutes: 5, description: "2 + 2" },
    ],
    assessment: "1",
    homework: "2",
  });
  const generator = scriptedGenerator([numeric]);
  const result = await generate(baseArgs({ generator }));
  assert.equal(result.ok, true);
  assert.equal(generator.calls.length, 1, "no wasted retry on undecidable content");
});

/* -------------------------------------------------------------------------- */
/* MCQ structure, through the pipeline                                        */
/* -------------------------------------------------------------------------- */

const questionsArgs = (overrides = {}) => ({
  toolId: "questions",
  options: {
    outputLanguage: "en",
    grade: "7",
    subject: "math",
    questionTypes: ["mcq"],
    count: "5",
    difficulty: "medium",
  },
  userId: "u",
  limiter: openLimiter,
  logger: capturingLogger(),
  ...overrides,
});

const mcqSet = (n, optionCount = 4) =>
  JSON.stringify({
    questions: Array.from({ length: n }, (_, i) => ({
      type: "mcq",
      prompt: `What is ${i + 1} times two?`,
      options: Array.from({ length: optionCount }, (_, k) => `Answer ${k + 1} for question ${i + 1}`),
      correctIndex: 0,
      answer: "Answer 1 for question " + (i + 1),
    })),
  });

test("mcq: a set with three options is rejected and repaired", async () => {
  const generator = scriptedGenerator([mcqSet(5, 3), mcqSet(5, 4)]);
  const result = await generate(questionsArgs({ generator }));

  assert.equal(result.ok, true, "the repair succeeds");
  assert.equal(generator.calls.length, 2);
  const repair = generator.calls[1].user;
  assert.match(repair, /expected exactly 4 options, received 3/);
});

test("mcq: the repair prompt never quotes an option's text", async () => {
  const generator = scriptedGenerator([mcqSet(5, 3), mcqSet(5, 4)]);
  await generate(questionsArgs({ generator }));

  const repair = generator.calls[1].user;
  assert.equal(repair.includes("Answer 1 for question"), false);
  assert.equal(repair.includes("times two"), false);
});

test("mcq: a set that stays malformed fails cleanly", async () => {
  const generator = scriptedGenerator([mcqSet(5, 3), mcqSet(5, 3)]);
  const result = await generate(questionsArgs({ generator }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(generator.calls.length, 2);
});

test("mcq: a short set is rejected because the requested count is not met", async () => {
  const generator = scriptedGenerator([mcqSet(3, 4), mcqSet(5, 4)]);
  const result = await generate(questionsArgs({ generator }));
  assert.equal(result.ok, true);
  assert.match(generator.calls[1].user, /expected 5 questions, received 3/);
});

test("mcq: an answer naming the wrong option is rejected and repaired", async () => {
  const wrong = JSON.stringify({
    questions: [
      {
        type: "mcq",
        prompt: "What is two times three?",
        options: ["Six", "Four", "Eight", "Ten"],
        correctIndex: 0,
        answer: "Four",
      },
    ],
  });
  const right = JSON.stringify({
    questions: [
      {
        type: "mcq",
        prompt: "What is two times three?",
        options: ["Six", "Four", "Eight", "Ten"],
        correctIndex: 0,
        answer: "Six",
      },
    ],
  });
  const generator = scriptedGenerator([wrong, right]);
  const result = await generate(
    questionsArgs({ generator, options: { ...questionsArgs().options, count: "1" } }),
  );

  assert.equal(result.ok, true);
  assert.equal(generator.calls.length, 2);
  assert.match(generator.calls[1].user, /does not match the option marked correct/);
  assert.equal(generator.calls[1].user.includes("Four"), false, "option text must not be echoed");
});

test("mcq: a well-formed set is not retried", async () => {
  const generator = scriptedGenerator([mcqSet(5, 4)]);
  const result = await generate(questionsArgs({ generator }));
  assert.equal(result.ok, true);
  assert.equal(generator.calls.length, 1);
});

/* -------------------------------------------------------------------------- */
/* Logging still holds with the new checks                                    */
/* -------------------------------------------------------------------------- */

test("logs: the language check logs the code and no content", async () => {
  const generator = scriptedGenerator([ENGLISH_PLAN, ENGLISH_PLAN]);
  const logger = capturingLogger();
  await generate(baseArgs({ generator, logger }));

  assert.match(logger.text(), /language_retry/);
  for (const phrase of ["Dividing fractions", "Whiteboard", "Warm-up"]) {
    assert.equal(logger.text().includes(phrase), false);
  }
  // Every line remains a closed set of scalars.
  const allowed = new Set(["scope", "code", "toolId", "status", "latencyMs", "attempts"]);
  for (const line of logger.lines) {
    for (const key of Object.keys(JSON.parse(line))) {
      assert.ok(allowed.has(key), `unexpected log field: ${key}`);
    }
  }
});

test("checks: the language check reads the payload, not the JSON keys", async () => {
  // An Arabic response in the questions shape contains the English keys
  // "correctIndex" and "true-false". Those must not drag it toward English.
  const arabicQuestions = JSON.stringify({
    questions: [
      {
        type: "mcq",
        prompt: "ما ناتج ضرب العدد اثنين في ثلاثة؟",
        options: ["ستة", "أربعة", "ثمانية", "عشرة"],
        correctIndex: 0,
        answer: "ستة",
      },
      {
        type: "mcq",
        prompt: "ما ناتج جمع العدد واحد مع العدد اثنين؟",
        options: ["ثلاثة", "أربعة", "خمسة", "ستة"],
        correctIndex: 0,
        answer: "ثلاثة",
      },
    ],
  });
  const generator = scriptedGenerator([arabicQuestions]);
  const result = await generate(
    questionsArgs({
      generator,
      options: { ...questionsArgs().options, outputLanguage: "ar", count: "2" },
    }),
  );
  assert.equal(result.ok, true, "an Arabic question set must not be retried as English");
  assert.equal(generator.calls.length, 1);
});

test("checks: tool metadata is unchanged by the new steps", () => {
  // A guard against the checks silently narrowing a tool's contract.
  for (const id of ["lesson-plan", "questions", "remedial-plan"]) {
    const tool = getTool(id);
    assert.ok(tool.inputSchema, `${id} keeps its input schema`);
    assert.ok(tool.outputSchema, `${id} keeps its output schema`);
  }
});
