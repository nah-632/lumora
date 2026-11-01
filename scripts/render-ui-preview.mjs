/**
 * Screenshot harness for the teacher tools UI.
 *
 * Why this exists: the real page is behind an auth guard and its result screen
 * needs a live provider. A dev-only preview route would ship in the bundle, so
 * instead this script renders the SAME components to static HTML using
 * `react-dom/server` and writes them to /tmp, which the sandbox serves.
 *
 * What it does NOT do: it does not re-implement any markup. It imports the real
 * ToolResult, ToolPicker and ToolForm and the real stylesheet, so what is
 * captured is what a teacher would see. The only fabricated part is the data.
 *
 * Run: node scripts/render-ui-preview.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { build } from "esbuild";

const OUT = "/tmp/ui-preview";
mkdirSync(OUT, { recursive: true });

/** Bundles the preview entry, aliasing `@/` to the repo's src. */
async function bundle() {
  const entry = `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { NextIntlClientProvider } from "next-intl";
    import { ToolResult } from "@/features/tools/components/ToolResult";
    import { ToolPicker } from "@/features/tools/components/ToolPicker";
    import { ToolForm } from "@/features/tools/components/ToolForm";
    import { TOOL_SPECS } from "@/features/tools/specs";
    export { React, renderToStaticMarkup, NextIntlClientProvider, ToolResult, ToolPicker, ToolForm, TOOL_SPECS };
  `;
  writeFileSync("/tmp/lumora-audit/.preview-entry.jsx", entry);

  await build({
    entryPoints: ["/tmp/lumora-audit/.preview-entry.jsx"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: "/tmp/lumora-audit/.preview-bundle.mjs",
    alias: { "@": "./src" },
    loader: { ".jsx": "jsx" },
    jsx: "automatic",
    // Kept external: they are resolved from the repo's node_modules at run time.
    external: ["react", "react-dom", "react-dom/server", "next-intl"],
    logLevel: "warning",
  });
}

const LESSON_PLAN = {
  title: "خطة درس: قسمة الكسور",
  objectives: [
    "أن يشرح الطالب معنى قسمة الكسر على الكسر",
    "أن يحل الطالب مسائل بسيطة على قسمة الكسور",
  ],
  materials: ["سبورة", "أوراق عمل", "أقلام ملونة"],
  stages: [
    { name: "تمهيد", minutes: 5, description: "مراجعة سريعة لدرس ضرب الكسور مع الطلاب" },
    { name: "شرح مباشر", minutes: 20, description: "يشرح المعلم المفهوم ثم يعرض مثالين على السبورة" },
    { name: "عمل تعاوني", minutes: 15, description: "يعمل الطلاب في مجموعات صغيرة على أوراق العمل" },
    { name: "تقويم ختامي", minutes: 5, description: "سؤال خروج قصير للتأكد من فهم الطلاب" },
  ],
  assessment: "سؤال خروج في نهاية الحصة: ما ناتج قسمة نصف على ربع؟",
  homework: "خمس مسائل من ورقة العمل، مع كتابة الخطوات كاملة",
};

const LESSON_PLAN_EN = {
  title: "Lesson plan: dividing fractions",
  objectives: [
    "Explain what dividing by a fraction means",
    "Solve simple problems involving division of fractions",
  ],
  materials: ["Whiteboard", "Worksheets", "Coloured pens"],
  stages: [
    { name: "Warm-up", minutes: 5, description: "A quick review of multiplying fractions with the class" },
    { name: "Direct instruction", minutes: 20, description: "Explain the concept, then work two examples on the board" },
    { name: "Collaborative work", minutes: 15, description: "Students work in small groups on the worksheets" },
    { name: "Exit assessment", minutes: 5, description: "A short exit question to check understanding" },
  ],
  assessment: "Exit question: what is one half divided by one quarter?",
  homework: "Five problems from the worksheet, showing every step",
};

const QUESTIONS = {
  questions: [
    {
      type: "mcq",
      prompt: "ما ناتج قسمة الكسر ١/٢ على الكسر ١/٤؟",
      options: ["١/٨", "٢", "١/٢", "٤"],
      correctIndex: 1,
      answer: "٢",
    },
    {
      type: "true-false",
      prompt: "قسمة العدد على كسر أصغر من واحد تعطي ناتجًا أكبر من العدد.",
      options: ["صح", "خطأ"],
      correctIndex: 0,
      answer: "صح",
    },
    {
      type: "short",
      prompt: "اشرح كيف تقسم كسرًا على كسر آخر بخطوات واضحة.",
      options: [],
      correctIndex: 0,
      answer: "نقلب المقسوم عليه ثم نضرب البسط في البسط والمقام في المقام.",
    },
  ],
};

const QUESTIONS_EN = {
  questions: [
    {
      type: "mcq",
      prompt: "What is one half divided by one quarter?",
      options: ["1/8", "2", "1/2", "4"],
      correctIndex: 1,
      answer: "2",
    },
    {
      type: "true-false",
      prompt: "Dividing a number by a fraction smaller than one gives a larger result.",
      options: ["True", "False"],
      correctIndex: 0,
      answer: "True",
    },
    {
      type: "short",
      prompt: "Explain how to divide one fraction by another.",
      options: [],
      correctIndex: 0,
      answer: "Invert the divisor, then multiply numerators and denominators.",
    },
  ],
};

const REMEDIAL = {
  summary: "يحتاج الطالب إلى تثبيت مفهوم الكسور المتكافئة قبل الانتقال إلى القسمة.",
  focusAreas: [
    { area: "الكسور المتكافئة", why: "أخطاء في كل محاولة على هذا المفهوم" },
    { area: "تبسيط الكسور", why: "لم يتقن القسمة على العامل المشترك" },
  ],
  sessions: [
    { name: "الجلسة الأولى: الكسور المتكافئة", activities: ["مجسمات محسوسة", "تدريب موجّه", "أسئلة قصيرة"], minutes: 40 },
    { name: "الجلسة الثانية: التبسيط", activities: ["جدول العوامل", "عمل ثنائي"], minutes: 35 },
  ],
  suggestedHomework: ["خمس مسائل على الكسور المتكافئة", "مسألتان على التبسيط"],
  encouragement: "تقدّم مطّرد هذا الأسبوع، والخطوة القادمة تثبيت التبسيط.",
};

const REMEDIAL_EN = {
  summary: "The student needs to consolidate equivalent fractions before moving on to division.",
  focusAreas: [
    { area: "Equivalent fractions", why: "Errors on every attempt at this concept" },
    { area: "Simplifying fractions", why: "Has not yet mastered dividing by a common factor" },
  ],
  sessions: [
    { name: "Session one: equivalent fractions", activities: ["Concrete models", "Guided practice", "Short questions"], minutes: 40 },
    { name: "Session two: simplifying", activities: ["Factor table", "Paired work"], minutes: 35 },
  ],
  suggestedHomework: ["Five equivalent-fraction problems", "Two simplifying problems"],
  encouragement: "Steady progress this week. The next step is consolidating simplification.",
};

const MESSAGES = {
  ar: JSON.parse(readFileSync("messages/ar.json", "utf8")),
  en: JSON.parse(readFileSync("messages/en.json", "utf8")),
};

const RESULTS = [
  { id: "lesson-plan", data: { ar: LESSON_PLAN, en: LESSON_PLAN_EN } },
  { id: "questions", data: { ar: QUESTIONS, en: QUESTIONS_EN } },
  { id: "remedial-plan", data: { ar: REMEDIAL, en: REMEDIAL_EN } },
];

const FORM_OPTIONS = {
  "lesson-plan": {
    outputLanguage: "ar",
    grade: "8",
    subject: "math",
    duration: "45",
    teachingStyles: ["inquiry", "collaborative"],
    topic: "",
  },
  questions: {
    outputLanguage: "ar",
    grade: "8",
    subject: "math",
    questionTypes: ["mcq", "true-false"],
    count: "10",
    difficulty: "medium",
    topic: "",
  },
  "remedial-plan": {
    outputLanguage: "ar",
    grade: "8",
    subject: "math",
    score: 45,
    difficultyTags: ["foundational-gaps", "procedural-fluency"],
    studentName: "",
    notes: "",
  },
};

async function main() {
  await bundle();
  const P = await import("/tmp/lumora-audit/.preview-bundle.mjs");
  const { React, renderToStaticMarkup, NextIntlClientProvider, ToolResult, ToolPicker, ToolForm, TOOL_SPECS } = P;

  const e = React.createElement;
  /** Renders one document for a given interface locale and output language. */
  function render(uiLocale, outputLanguage, toolId, withForm) {
    const spec = RESULTS.find((r) => r.id === toolId);
    const result = { toolId, outputLanguage, data: spec.data[outputLanguage] };

    const children = [
      withForm
        ? e(ToolPicker, { key: "picker", activeId: toolId, onSelect: () => {} })
        : null,
      withForm
        ? e(
            "div",
            { key: "form", className: "tools-panel" },
            e(ToolForm, {
              // The real spec from the registry, so the field list under test is
              // the one the teacher sees, not a hand-written stub.
              tool: TOOL_SPECS.find((s) => s.id === toolId),
              options: FORM_OPTIONS[toolId],
              onChange: () => {},
              onSubmit: () => {},
              onCancel: () => {},
              busy: false,
              outputLanguage,
              onOutputLanguageChange: () => {},
              ack: toolId === "remedial-plan",
              onAckChange: () => {},
              ackError: null,
            }),
          )
        : null,
      e(ToolResult, {
        key: "result",
        result,
        onRegenerate: () => {},
        onEdit: () => {},
        onCopy: () => {},
        onPrint: () => {},
        copied: false,
        copyFailed: false,
        busy: false,
        locale: uiLocale,
      }),
    ].filter(Boolean);

    const body = renderToStaticMarkup(
      e(
        NextIntlClientProvider,
        { locale: uiLocale, messages: MESSAGES[uiLocale] },
        e("div", { className: "preview-shell" }, children),
      ),
    );

    const dir = uiLocale === "ar" ? "rtl" : "ltr";
    const css = readFileSync("src/styles/tools.css", "utf8");
    const globalsSubset = `
      :root {
        --lumora-red: #DA291C; --lumora-navy: #1D2A44; --lumora-purple: #4B1E61;
        --lumora-gold: #D4AF37; --lumora-paper: #F8F9FA; --lumora-ink: #16202f;
        --lumora-ink-soft: #5a6675; --lumora-line: #e3e7ec;
        --font-display: system-ui, sans-serif;
        --font-arabic: "Noto Naskh Arabic", "Segoe UI", system-ui, sans-serif;
        --font-latin: system-ui, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: var(--lumora-ink);
             font-family: ${uiLocale === "ar" ? "var(--font-arabic)" : "var(--font-latin)"}; }
      .preview-shell { max-width: 1024px; margin: 0 auto; padding: 24px 16px 64px;
                       display: flex; flex-direction: column; gap: 28px; }
      ul, ol, p, h1, h2, h3, h4 { margin: 0; }
      h1, h2, h3, h4, p { line-height: inherit; }
    `;

    return `<!doctype html>
<html lang="${uiLocale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tools preview ${uiLocale}/${outputLanguage}/${toolId}</title>
<style>${globalsSubset}</style>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;
  }

  let count = 0;
  for (const uiLocale of ["ar", "en"]) {
    for (const outputLanguage of ["ar", "en"]) {
      for (const toolId of ["lesson-plan", "questions", "remedial-plan"]) {
        for (const withForm of [true, false]) {
          const html = render(uiLocale, outputLanguage, toolId, withForm);
          const name = `${uiLocale}-ui_${outputLanguage}-out_${toolId}_${withForm ? "form" : "result"}.html`;
          writeFileSync(`${OUT}/${name}`, html);
          count += 1;
        }
      }
    }
  }

  console.log(`wrote ${count} preview files to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
