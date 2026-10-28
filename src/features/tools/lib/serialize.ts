/**
 * Turns a generated result into plain text for the clipboard.
 *
 * This exists as a separate, testable function rather than being inlined in the
 * component because the two things that are easy to get wrong here are exactly
 * the two that matter:
 *
 * 1. THE ANSWER KEY MUST SURVIVE. A copied question set without its key is
 *    useless to a teacher — they would have to answer their own questions. The
 *    key is written twice: beside each question, and again as a compact list at
 *    the end, matching the on-screen result.
 *
 * 2. NO UNRESOLVED PLACEHOLDERS. Translation strings carry placeholders such as
 *    "{count}". A naive copy would paste the literal braces into a teacher's
 *    document.
 *
 * The caller supplies already-translated labels, so this function has no locale
 * dependency and can be tested with plain strings.
 */

export interface SerializeLabels {
  lessonPlanTitle: string;
  questionsTitle: string;
  remedialTitle: string;
  objectives: string;
  materials: string;
  stages: string;
  assessment: string;
  homework: string;
  minutes: string;
  answerKey: string;
  answer: string;
  modelAnswer: string;
  correct: string;
  focusAreas: string;
  why: string;
  sessions: string;
  suggestedHomework: string;
  encouragement: string;
  draftNotice: string;
}

export interface SerializableResult {
  toolId: string;
  outputLanguage: "ar" | "en";
  data: unknown;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Replaces {name} placeholders. A missing value collapses rather than printing braces. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : "",
  );
}

function bullet(items: string[], indent = ""): string {
  return items.map((item) => `${indent}- ${item}`).join("\n");
}

export function resultToPlainText(result: SerializableResult, opts: { labels: SerializeLabels }): string {
  const L = opts.labels;
  const data = asRecord(result.data);
  const lines: string[] = [];

  lines.push(L.draftNotice);
  lines.push("");

  if (result.toolId === "lesson-plan") {
    lines.push(asString(data.title) || L.lessonPlanTitle);

    const objectives = asArray(data.objectives).map(asString);
    if (objectives.length) {
      lines.push("");
      lines.push(`${L.objectives}:`);
      lines.push(bullet(objectives));
    }

    const materials = asArray(data.materials).map(asString);
    if (materials.length) {
      lines.push("");
      lines.push(`${L.materials}:`);
      lines.push(bullet(materials));
    }

    const stages = asArray(data.stages).map(asRecord);
    if (stages.length) {
      lines.push("");
      lines.push(`${L.stages}:`);
      stages.forEach((stage, i) => {
        const minutes = fill(L.minutes, { count: Number(stage.minutes) || 0 });
        lines.push(`${i + 1}. ${asString(stage.name)} (${minutes})`);
        if (asString(stage.description)) lines.push(`   ${asString(stage.description)}`);
      });
    }

    if (asString(data.assessment)) {
      lines.push("");
      lines.push(`${L.assessment}:`);
      lines.push(asString(data.assessment));
    }

    if (asString(data.homework)) {
      lines.push("");
      lines.push(`${L.homework}:`);
      lines.push(asString(data.homework));
    }
  }

  if (result.toolId === "questions") {
    lines.push(L.questionsTitle);
    const questions = asArray(data.questions).map(asRecord);

    questions.forEach((q, i) => {
      const type = asString(q.type);
      const options = asArray(q.options).map(asString);
      const correctIndex = Number(q.correctIndex);

      lines.push("");
      lines.push(`${i + 1}. ${asString(q.prompt)}`);

      if (type === "mcq" || type === "true-false") {
        options.forEach((opt, k) => {
          const mark = k === correctIndex ? "\u2713" : " ";
          lines.push(`   ${mark} ${opt}`);
        });
        lines.push(`   ${L.correct}: ${asString(q.answer)}`);
      } else {
        lines.push(`   ${L.modelAnswer}: ${asString(q.answer)}`);
      }
    });

    // The key again, compact — this is what makes a copied set usable.
    if (questions.length) {
      lines.push("");
      lines.push(`${L.answerKey}:`);
      questions.forEach((q, i) => {
        const type = asString(q.type);
        const options = asArray(q.options).map(asString);
        const correctIndex = Number(q.correctIndex);
        const key =
          type === "short"
            ? asString(q.answer)
            : options[correctIndex] !== undefined
              ? options[correctIndex]
              : asString(q.answer);
        lines.push(`${i + 1}. ${key}`);
      });
    }
  }

  if (result.toolId === "remedial-plan") {
    lines.push(L.remedialTitle);
    if (asString(data.summary)) {
      lines.push("");
      lines.push(asString(data.summary));
    }

    const focus = asArray(data.focusAreas).map(asRecord);
    if (focus.length) {
      lines.push("");
      lines.push(`${L.focusAreas}:`);
      for (const f of focus) {
        lines.push(`- ${asString(f.area)}`);
        if (asString(f.why)) lines.push(`  ${L.why}: ${asString(f.why)}`);
      }
    }

    const sessions = asArray(data.sessions).map(asRecord);
    if (sessions.length) {
      lines.push("");
      lines.push(`${L.sessions}:`);
      sessions.forEach((s, i) => {
        const minutes = fill(L.minutes, { count: Number(s.minutes) || 0 });
        lines.push(`${i + 1}. ${asString(s.name)} (${minutes})`);
        const activities = asArray(s.activities).map(asString);
        if (activities.length) lines.push(bullet(activities, "   "));
      });
    }

    const homework = asArray(data.suggestedHomework).map(asString);
    if (homework.length) {
      lines.push("");
      lines.push(`${L.suggestedHomework}:`);
      lines.push(bullet(homework));
    }

    if (asString(data.encouragement)) {
      lines.push("");
      lines.push(`${L.encouragement}:`);
      lines.push(asString(data.encouragement));
    }
  }

  return lines.join("\n").trim() + "\n";
}
