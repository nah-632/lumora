/**
 * Registry tests for the AI teacher tools.
 *
 * These exercise the real module through the esbuild bundle produced by
 * build-tests.sh, so the schemas under test are the ones the route will use.
 *
 * The point of most of these cases is rejection: an unknown tool id, an unknown
 * field, an out-of-range enum or a control character must not reach a prompt.
 *
 * Run with: node --test tests/ai/tools.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  TOOL_IDS,
  getTool,
  isToolId,
  listTools,
  resolvePrompts,
  stripControlChars,
  unfenceJson,
} = await import("../../build-test/tools.mjs");

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

test("registry: every listed id resolves, and only those do", () => {
  for (const id of TOOL_IDS) {
    assert.ok(getTool(id), `${id} should resolve`);
  }
  assert.equal(getTool("nope"), null);
  assert.equal(getTool(""), null);
  assert.equal(getTool("Lesson-Plan"), null, "lookup is case-sensitive");
  assert.equal(isToolId("__proto__"), false, "prototype keys are not tool ids");
  assert.equal(isToolId("constructor"), false);
});

test("registry: the three expected tools are present with both prompt languages", () => {
  const tools = listTools();
  assert.deepEqual(
    tools.map((t) => t.id),
    ["lesson-plan", "questions", "remedial-plan"],
  );
  for (const tool of tools) {
    for (const lang of ["ar", "en"]) {
      assert.ok(tool.systemPrompt[lang].length > 40, `${tool.id}/${lang} system prompt`);
      assert.ok(tool.taskPrompt[lang].length > 10, `${tool.id}/${lang} task prompt`);
    }
    assert.notEqual(tool.systemPrompt.ar, tool.systemPrompt.en, `${tool.id} prompts must differ by language`);
    assert.ok(tool.titleKey.startsWith("tools."), `${tool.id} titleKey`);
    assert.ok(tool.descriptionKey.startsWith("tools."), `${tool.id} descriptionKey`);
  }
});

/* -------------------------------------------------------------------------- */
/* Input validation                                                           */
/* -------------------------------------------------------------------------- */

const validLessonPlan = {
  outputLanguage: "ar",
  grade: "8",
  subject: "science",
  duration: "45",
  teachingStyles: ["inquiry"],
};

test("lesson-plan: accepts a minimal valid payload and drops an absent topic", () => {
  const tool = getTool("lesson-plan");
  const parsed = tool.inputSchema.parse(validLessonPlan);
  assert.equal(parsed.topic, undefined);
  assert.equal(parsed.grade, "8");
});

test("lesson-plan: rejects unknown fields", () => {
  const tool = getTool("lesson-plan");
  const result = tool.inputSchema.safeParse({ ...validLessonPlan, admin: true });
  assert.equal(result.success, false, "strict objects must reject extra keys");
});

test("lesson-plan: rejects an invalid enum value", () => {
  const tool = getTool("lesson-plan");
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, duration: "90" }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, subject: "history" }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, outputLanguage: "fr" }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, teachingStyles: [] }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, teachingStyles: ["lecture"] }).success, false);
});

test("lesson-plan: rejects a topic over the length cap", () => {
  const tool = getTool("lesson-plan");
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, topic: "x".repeat(121) }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, topic: "x".repeat(120) }).success, true);
});

test("questions: enforces count, difficulty and at least one type", () => {
  const tool = getTool("questions");
  const base = { outputLanguage: "en", grade: "7", subject: "math", questionTypes: ["mcq"], count: "10", difficulty: "mixed" };
  assert.equal(tool.inputSchema.safeParse(base).success, true);
  assert.equal(tool.inputSchema.safeParse({ ...base, count: "12" }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, difficulty: "impossible" }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, questionTypes: [] }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, questionTypes: ["essay"] }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, extra: 1 }).success, false);
});

test("remedial-plan: score is bounded 0-100 and tags are constrained", () => {
  const tool = getTool("remedial-plan");
  const base = { outputLanguage: "ar", grade: "9", subject: "arabic", score: 40, difficultyTags: ["vocabulary"] };
  assert.equal(tool.inputSchema.safeParse(base).success, true);
  assert.equal(tool.inputSchema.safeParse({ ...base, score: 0 }).success, true);
  assert.equal(tool.inputSchema.safeParse({ ...base, score: 100 }).success, true);
  assert.equal(tool.inputSchema.safeParse({ ...base, score: -1 }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, score: 101 }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, score: "40" }).success, false, "score is a number, not a string");
  assert.equal(tool.inputSchema.safeParse({ ...base, difficultyTags: [] }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, difficultyTags: ["lazy"] }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, name: "Ali" }).success, false, "field is studentName");
});

test("remedial-plan: student name and notes are capped and optional", () => {
  const tool = getTool("remedial-plan");
  const base = { outputLanguage: "en", grade: "7", subject: "english", score: 55, difficultyTags: ["vocabulary"] };
  assert.equal(tool.inputSchema.safeParse({ ...base, studentName: "x".repeat(51) }).success, false);
  assert.equal(tool.inputSchema.safeParse({ ...base, studentName: "x".repeat(50) }).success, true);
  assert.equal(tool.inputSchema.safeParse({ ...base, notes: "y".repeat(501) }).success, false);
  const parsed = tool.inputSchema.parse({ ...base, studentName: "", notes: "" });
  assert.equal(parsed.studentName, undefined, "empty string means absent");
  assert.equal(parsed.notes, undefined);
});

/* -------------------------------------------------------------------------- */
/* Sanitisation of free text                                                  */
/* -------------------------------------------------------------------------- */

test("stripControlChars: removes C0/DEL/C1 but keeps tab and newline", () => {
  assert.equal(stripControlChars("a\u0000b\u0007c"), "abc");
  assert.equal(stripControlChars("line1\nline2\ttab"), "line1\nline2\ttab");
  assert.equal(stripControlChars("del\u007fme"), "delme");
  assert.equal(stripControlChars("c1\u0085x"), "c1x");
});

test("stripControlChars: removes bidi overrides and zero-width joiners", () => {
  const hostile = "مرحبا\u202Etset\u200B\uFEFF";
  const cleaned = stripControlChars(hostile);
  assert.equal(cleaned, "مرحباtset");
  assert.equal(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(cleaned), false);
});

test("free text: a control-character-only topic collapses to absent", () => {
  const tool = getTool("lesson-plan");
  const parsed = tool.inputSchema.parse({ ...validLessonPlan, topic: "\u0000\u200b\u202e" });
  assert.equal(parsed.topic, undefined);
});

test("free text: sanitising happens before the length cap is measured", () => {
  const tool = getTool("lesson-plan");
  // 120 real characters plus 40 invisible ones: the visible text is within the
  // cap, so this must pass — the cap is about what the model receives.
  const padded = "x".repeat(120) + "\u0000".repeat(40);
  assert.equal(tool.inputSchema.safeParse({ ...validLessonPlan, topic: padded }).success, true);
});

test("free text: surrounding whitespace is trimmed", () => {
  const tool = getTool("lesson-plan");
  const parsed = tool.inputSchema.parse({ ...validLessonPlan, topic: "   القسمة   " });
  assert.equal(parsed.topic, "القسمة");
});

/* -------------------------------------------------------------------------- */
/* Prompt selection                                                           */
/* -------------------------------------------------------------------------- */

test("prompts: the variant follows outputLanguage, not anything else", () => {
  const arabic = resolvePrompts("lesson-plan", "ar");
  const english = resolvePrompts("lesson-plan", "en");
  assert.notEqual(arabic.system, english.system);
  assert.match(arabic.system, /[\u0600-\u06FF]/u, "arabic system prompt should contain Arabic script");
  assert.doesNotMatch(english.system, /[\u0600-\u06FF]/u, "english system prompt should not contain Arabic script");
  assert.match(english.system, /FIXED RULES/);
});

test("prompts: the same language is chosen for every tool", () => {
  for (const id of TOOL_IDS) {
    assert.equal(resolvePrompts(id, "en").system, getTool(id).systemPrompt.en);
    assert.equal(resolvePrompts(id, "ar").system, getTool(id).systemPrompt.ar);
  }
});

test("prompts: the user message records the requested output language", () => {
  const tool = getTool("lesson-plan");
  const input = tool.inputSchema.parse({ ...validLessonPlan, outputLanguage: "en" });
  const message = tool.buildUserMessage(input);
  assert.match(message, /output_language: en/);
  assert.match(message, /grade: 8/);
  assert.match(message, /subject: science/);
});

test("prompts: an absent topic is stated as absent rather than left blank", () => {
  const tool = getTool("lesson-plan");
  const message = tool.buildUserMessage(tool.inputSchema.parse(validLessonPlan));
  assert.match(message, /topic: \(not given/);
});

/* -------------------------------------------------------------------------- */
/* Token budgets                                                              */
/* -------------------------------------------------------------------------- */

test("token budget: the questions budget scales with the requested count", () => {
  const tool = getTool("questions");
  const budget = (count) =>
    tool.maxOutputTokens(
      tool.inputSchema.parse({
        outputLanguage: "en",
        grade: "7",
        subject: "math",
        questionTypes: ["mcq"],
        count,
        difficulty: "medium",
      }),
    );
  assert.ok(budget("15") > budget("10"));
  assert.ok(budget("10") > budget("5"));
  assert.ok(budget("5") >= 1000, "5 questions still need room for the wrapper JSON");
});

test("token budget: fixed budgets are positive integers", () => {
  const lesson = getTool("lesson-plan").maxOutputTokens(
    getTool("lesson-plan").inputSchema.parse(validLessonPlan),
  );
  assert.equal(lesson, 2500);
  const remedial = getTool("remedial-plan").maxOutputTokens(
    getTool("remedial-plan").inputSchema.parse({
      outputLanguage: "ar",
      grade: "9",
      subject: "arabic",
      score: 30,
      difficultyTags: ["vocabulary"],
    }),
  );
  assert.equal(remedial, 1500);
});

/* -------------------------------------------------------------------------- */
/* Output schema                                                              */
/* -------------------------------------------------------------------------- */

test("output schema: a well-formed lesson plan validates", () => {
  const tool = getTool("lesson-plan");
  const ok = tool.outputSchema.safeParse({
    title: "قسمة الكسور",
    objectives: ["يفهم الطالب معنى القسمة", "يحل مسائل بسيطة"],
    materials: ["سبورة", "أوراق عمل"],
    stages: [
      { name: "تهيئة", minutes: 5, description: "سؤال افتتاحي" },
      { name: "تدريس", minutes: 25, description: "شرح مباشر" },
    ],
    assessment: "خروج سريع",
    homework: "خمس مسائل",
  });
  assert.equal(ok.success, true);
});

test("output schema: a lesson plan with one objective is rejected", () => {
  const tool = getTool("lesson-plan");
  const bad = tool.outputSchema.safeParse({
    title: "t",
    objectives: ["only one"],
    materials: [],
    stages: [
      { name: "a", minutes: 5, description: "d" },
      { name: "b", minutes: 5, description: "d" },
    ],
    assessment: "a",
    homework: "h",
  });
  assert.equal(bad.success, false);
});

test("output schema: a question with five options is rejected", () => {
  const tool = getTool("questions");
  const bad = tool.outputSchema.safeParse({
    questions: [
      {
        type: "mcq",
        prompt: "p",
        options: ["a", "b", "c", "d", "e"],
        correctIndex: 0,
        answer: "a",
      },
    ],
  });
  assert.equal(bad.success, false);
});

test("output schema: the questions count cap holds at 15", () => {
  const tool = getTool("questions");
  const item = (i) => ({ type: "short", prompt: `q${i}`, options: [], correctIndex: 0, answer: "a" });
  assert.equal(tool.outputSchema.safeParse({ questions: Array.from({ length: 15 }, (_, i) => item(i)) }).success, true);
  assert.equal(tool.outputSchema.safeParse({ questions: Array.from({ length: 16 }, (_, i) => item(i)) }).success, false);
});

/* -------------------------------------------------------------------------- */
/* JSON fences                                                                */
/* -------------------------------------------------------------------------- */

test("unfenceJson: strips a fenced block but leaves clean JSON untouched", () => {
  assert.equal(unfenceJson('{"a":1}'), '{"a":1}');
  assert.equal(unfenceJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(unfenceJson('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(unfenceJson('  ```json\n{"a":1}\n```  '), '{"a":1}');
});
