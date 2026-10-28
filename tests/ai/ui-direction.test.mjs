/**
 * Tests for the result screen's direction rules and the copy output.
 *
 * Two things here are easy to get right by accident and wrong in production:
 *
 * 1. DIRECTION. The container's `dir` and `lang` must come from the draft's
 *    output language, not the interface locale. All four combinations of
 *    (interface locale × draft language) must be checked, because the failing case
 *    is the mismatched pair — an English draft on the Arabic interface — and it is
 *    the one nobody looks at by hand.
 *
 * 2. THE ANSWER KEY. A copied question set without its key cannot be used. The key
 *    is asserted both inline and as the trailing list.
 *
 * Run with: node --test tests/ai/ui-direction.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resultToPlainText } = await import("../../build-test/serialize.mjs");
const { directionFor, documentAttributes } = await import("../../build-test/direction.mjs");
const { TOOL_SPECS, defaultOptions } = await import("../../build-test/specs.mjs");
const { getTool } = await import("../../build-test/tools.mjs");

/* -------------------------------------------------------------------------- */
/* Direction: all four interface x draft combinations                         */
/* -------------------------------------------------------------------------- */

test("direction: rtl is chosen for Arabic output regardless of interface locale", () => {
  assert.equal(directionFor("ar"), "rtl");
  assert.equal(directionFor("en"), "ltr");
});

test("direction: the four UI x output combinations produce the right pair", () => {
  const cases = [
    { locale: "ar", outputLanguage: "ar", dir: "rtl", lang: "ar" },
    { locale: "ar", outputLanguage: "en", dir: "ltr", lang: "en" },
    { locale: "en", outputLanguage: "ar", dir: "rtl", lang: "ar" },
    { locale: "en", outputLanguage: "en", dir: "ltr", lang: "en" },
  ];

  for (const c of cases) {
    const attrs = documentAttributes({ outputLanguage: c.outputLanguage, locale: c.locale });
    assert.equal(attrs.dir, c.dir, `${c.locale} UI + ${c.outputLanguage} draft should be ${c.dir}`);
    assert.equal(attrs.lang, c.lang);
  }
});

test("direction: the interface locale never determines the document direction", () => {
  // The two mismatched cases are the ones that break if this is wired wrongly.
  const arUiEnglishDraft = documentAttributes({ outputLanguage: "en", locale: "ar" });
  assert.equal(arUiEnglishDraft.dir, "ltr", "an English draft on the Arabic UI must be LTR");

  const enUiArabicDraft = documentAttributes({ outputLanguage: "ar", locale: "en" });
  assert.equal(enUiArabicDraft.dir, "rtl", "an Arabic draft on the English UI must be RTL");
});

/* -------------------------------------------------------------------------- */
/* Copy output: the answer key                                                */
/* -------------------------------------------------------------------------- */

const LABELS = {
  lessonPlanTitle: "Lesson plan",
  questionsTitle: "Questions",
  remedialTitle: "Remedial plan",
  objectives: "Objectives",
  materials: "Materials",
  stages: "Lesson stages",
  assessment: "Assessment",
  homework: "Homework",
  minutes: "{count} minutes",
  answerKey: "Answer key",
  answer: "Answer",
  modelAnswer: "Model answer",
  correct: "Correct answer",
  focusAreas: "Focus areas",
  why: "Why",
  sessions: "Sessions",
  suggestedHomework: "Suggested homework",
  encouragement: "Encouragement",
  draftNotice: "AI draft - review before use.",
};

const QUESTION_SET = {
  toolId: "questions",
  outputLanguage: "en",
  data: {
    questions: [
      {
        type: "mcq",
        prompt: "What is half of ten?",
        options: ["Two", "Five", "Ten", "Twenty"],
        correctIndex: 1,
        answer: "Five",
      },
      {
        type: "true-false",
        prompt: "A quarter is larger than a half.",
        options: ["True", "False"],
        correctIndex: 1,
        answer: "False",
      },
      {
        type: "short",
        prompt: "Explain how to divide by a fraction.",
        options: [],
        correctIndex: 0,
        answer: "Invert the divisor and multiply.",
      },
    ],
  },
};

test("copy: the answer key is present as a trailing list", () => {
  const text = resultToPlainText(QUESTION_SET, { labels: LABELS });
  const keyIndex = text.indexOf("Answer key:");
  assert.ok(keyIndex > -1, "a copied question set must carry its key");

  const keySection = text.slice(keyIndex);
  assert.match(keySection, /1\. Five/, "question 1's correct option is in the key");
  assert.match(keySection, /2\. False/, "question 2's correct option is in the key");
  assert.match(keySection, /3\. Invert the divisor and multiply\./, "a short answer uses the model answer");
});

test("copy: the correct option is also marked inline", () => {
  const text = resultToPlainText(QUESTION_SET, { labels: LABELS });
  // The check mark marks the correct option, so a reader does not have to look up.
  assert.match(text, /\u2713 Five/);
  assert.match(text, /\u2713 False/);
  // And the wrong options are not marked.
  assert.equal(/\u2713 Two/.test(text), false);
  assert.equal(/\u2713 True/.test(text), false);
});

test("copy: every question carries its own answer line", () => {
  const text = resultToPlainText(QUESTION_SET, { labels: LABELS });
  assert.match(text, /Correct answer: Five/);
  assert.match(text, /Correct answer: False/);
  assert.match(text, /Model answer: Invert the divisor and multiply\./);
});

test("copy: no unresolved placeholder survives into the text", () => {
  const lesson = {
    toolId: "lesson-plan",
    outputLanguage: "ar",
    data: {
      title: "قسمة الكسور",
      objectives: ["يفهم الطالب", "يحل مسائل"],
      materials: ["سبورة"],
      stages: [
        { name: "تمهيد", minutes: 5, description: "مراجعة" },
        { name: "شرح", minutes: 30, description: "شرح المفهوم" },
      ],
      assessment: "سؤال خروج",
      homework: "خمس مسائل",
    },
  };
  const text = resultToPlainText(lesson, { labels: LABELS });
  assert.equal(/\{\w+\}/.test(text), false, "a placeholder leaked into the copied text");
  assert.match(text, /5 minutes/);
  assert.match(text, /30 minutes/);
});

test("copy: the draft notice leads the text", () => {
  const text = resultToPlainText(QUESTION_SET, { labels: LABELS });
  assert.ok(text.startsWith("AI draft - review before use."), "the notice must not be buried");
});

test("copy: a remedial plan carries its focus areas and sessions", () => {
  const plan = {
    toolId: "remedial-plan",
    outputLanguage: "en",
    data: {
      summary: "Needs consolidation of fractions.",
      focusAreas: [{ area: "Equivalent fractions", why: "Errors in every attempt" }],
      sessions: [{ name: "Session one", activities: ["Concrete models", "Guided practice"], minutes: 40 }],
      suggestedHomework: ["Five equivalence problems"],
      encouragement: "Steady progress this week.",
    },
  };
  const text = resultToPlainText(plan, { labels: LABELS });
  assert.match(text, /Equivalent fractions/);
  assert.match(text, /Why: Errors in every attempt/);
  assert.match(text, /Concrete models/);
  assert.match(text, /Five equivalence problems/);
  assert.match(text, /Steady progress this week\./);
});

test("copy: empty optional sections do not produce dangling headings", () => {
  const lesson = {
    toolId: "lesson-plan",
    outputLanguage: "en",
    data: {
      title: "A lesson",
      objectives: ["One", "Two"],
      materials: [],
      stages: [
        { name: "a", minutes: 5, description: "d" },
        { name: "b", minutes: 5, description: "d" },
      ],
      assessment: "an assessment",
      homework: "some homework",
    },
  };
  const text = resultToPlainText(lesson, { labels: LABELS });
  assert.equal(/^Materials:$/m.test(text), false, "an empty materials list must not print its heading");
  assert.match(text, /Objectives:/);
  assert.match(text, /Assessment:/);
});

/* -------------------------------------------------------------------------- */
/* The client specs must not offer a choice the server would reject            */
/* -------------------------------------------------------------------------- */

test("specs: every option value in the UI is accepted by the server schema", () => {
  // This is what keeps the duplicated vocabulary honest. If these drift, the
  // teacher gets a 400 for a choice the interface offered.
  const base = { outputLanguage: "en", grade: "8", subject: "math" };

  for (const spec of TOOL_SPECS) {
    const tool = getTool(spec.id);
    assert.ok(tool, `${spec.id} must exist in the server registry`);

    // Build a payload from the spec's own defaults, then swap one value at a
    // time so each enum member is exercised.
    for (const field of spec.fields) {
      if (!field.options) continue;
      for (const option of field.options) {
        const options = { ...defaultOptions(spec), ...base };
        options[field.name] = field.kind === "multi" ? [option.value] : option.value;
        const parsed = tool.inputSchema.safeParse(options);
        assert.equal(
          parsed.success,
          true,
          `${spec.id}.${field.name} = "${option.value}" must be accepted by the server schema`,
        );
      }
    }
  }
});

test("specs: the default options for every tool are valid", () => {
  for (const spec of TOOL_SPECS) {
    const tool = getTool(spec.id);
    const parsed = tool.inputSchema.safeParse(defaultOptions(spec));
    assert.equal(parsed.success, true, `${spec.id} defaults must satisfy ${JSON.stringify(parsed.error?.issues)}`);
  }
});

test("specs: the three tools the API knows about are all offered in the UI", () => {
  const offered = TOOL_SPECS.map((s) => s.id).sort();
  assert.deepEqual(offered, ["lesson-plan", "questions", "remedial-plan"]);
});

/* -------------------------------------------------------------------------- */
/* Every label and option key must exist in BOTH catalogs                      */
/* -------------------------------------------------------------------------- */

test("messages: every key the UI uses resolves in both catalogs", () => {
  // A missing key is not an error next-intl throws in production — it renders the
  // key path itself into the interface. This test is the only thing that catches
  // it, so it walks every key the form and result actually look up.
  const catalogs = {
    ar: JSON.parse(readFileSync("messages/ar.json", "utf8")),
    en: JSON.parse(readFileSync("messages/en.json", "utf8")),
  };

  const resolve = (catalog, path) =>
    path.split(".").reduce((node, part) => (node == null ? undefined : node[part]), catalog);

  const keys = new Set();

  // Tool-level: labels, hints and the notice.
  for (const spec of TOOL_SPECS) {
    keys.add(`tools.${spec.toolKey}.title`);
    keys.add(`tools.${spec.toolKey}.description`);
    for (const field of spec.fields) {
      keys.add(`tools.${spec.toolKey}.${field.labelKey}`);
      if (field.hintKey) keys.add(`tools.${spec.toolKey}.${field.hintKey}`);
      for (const option of field.options ?? []) keys.add(`tools.${option.key}`);
    }
  }

  // Shared chrome the components reference directly.
  const shared = [
    "tools.picker.heading",
    "tools.a11y.picker",
    "tools.a11y.optionsForm",
    "tools.a11y.resultRegion",
    "tools.a11y.busy",
    "tools.a11y.outputLanguage",
    "tools.actions.generate",
    "tools.actions.generating",
    "tools.actions.cancel",
    "tools.actions.regenerate",
    "tools.actions.editOptions",
    "tools.actions.copy",
    "tools.actions.copied",
    "tools.actions.copyFailed",
    "tools.actions.print",
    "tools.actions.retry",
    "tools.notices.draft",
    "tools.notices.draftLong",
    "tools.notices.unavailable",
    "tools.notices.cancelled",
    "tools.remedialPlan.notice",
    "tools.remedialPlan.noticeAck",
    "tools.remedialPlan.noticeRequired",
    "tools.errors.unauthorized",
    "tools.errors.invalid_input",
    "tools.errors.ai_not_configured",
    "tools.errors.rate_limited",
    "tools.errors.quota_exceeded",
    "tools.errors.ai_output_invalid",
    "tools.errors.truncated",
    "tools.errors.failed",
    "tools.result.lessonPlanTitle",
    "tools.result.questionsTitle",
    "tools.result.remedialTitle",
    "tools.result.objectives",
    "tools.result.materials",
    "tools.result.stages",
    "tools.result.assessment",
    "tools.result.homework",
    "tools.result.minutes",
    "tools.result.answerKey",
    "tools.result.correct",
    "tools.result.answer",
    "tools.result.modelAnswer",
    "tools.result.focusAreas",
    "tools.result.why",
    "tools.result.sessions",
    "tools.result.suggestedHomework",
    "tools.result.encouragement",
    "tools.result.questionNumber",
  ];
  for (const key of shared) keys.add(key);

  const missing = [];
  for (const key of keys) {
    for (const locale of ["ar", "en"]) {
      const value = resolve(catalogs[locale], key);
      if (typeof value !== "string") missing.push(`${locale}: ${key}`);
    }
  }

  assert.deepEqual(missing, [], `missing message keys:\n${missing.join("\n")}`);
});
