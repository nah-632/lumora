/**
 * The client-side view of the tool registry.
 *
 * The server registry (`src/lib/ai/tools.ts`) is the authority on what a tool
 * accepts: it defines the schemas and rejects anything else. This file only says
 * how to PRESENT those options — labels, order, and which control to use.
 *
 * The two must agree on values, and a test asserts that every option value here
 * is accepted by the corresponding server schema. That keeps the duplication
 * honest: the UI cannot offer a choice the API would reject, and it is a
 * build-time failure rather than a 400 at the teacher's expense.
 */

export type OutputLanguage = "ar" | "en";

/** Message keys for an enum, so a label is never hard-coded in a component. */
export interface Option {
  value: string;
  /** Message key, relative to the `tools` namespace. */
  key: string;
}

/** Grade and question-count labels are plain numbers, so they are grouped by kind. */
export const GRADES: Option[] = [
  { value: "7", key: "grades.7" },
  { value: "8", key: "grades.8" },
  { value: "9", key: "grades.9" },
];

export const SUBJECTS: Option[] = [
  { value: "math", key: "subjects.math" },
  { value: "science", key: "subjects.science" },
  { value: "arabic", key: "subjects.arabic" },
  { value: "english", key: "subjects.english" },
  { value: "islamic-studies", key: "subjects.islamic-studies" },
  { value: "social-studies", key: "subjects.social-studies" },
  { value: "ict", key: "subjects.ict" },
];

export const DURATIONS: Option[] = [
  { value: "30", key: "duration.30" },
  { value: "45", key: "duration.45" },
  { value: "60", key: "duration.60" },
];

export const TEACHING_STYLES: Option[] = [
  { value: "direct", key: "teachingStyles.direct" },
  { value: "inquiry", key: "teachingStyles.inquiry" },
  { value: "collaborative", key: "teachingStyles.collaborative" },
  { value: "project", key: "teachingStyles.project" },
  { value: "differentiated", key: "teachingStyles.differentiated" },
];

export const QUESTION_TYPES: Option[] = [
  { value: "mcq", key: "questionTypes.mcq" },
  { value: "true-false", key: "questionTypes.true-false" },
  { value: "short", key: "questionTypes.short" },
];

export const QUESTION_COUNTS: Option[] = [
  { value: "5", key: "counts.5" },
  { value: "10", key: "counts.10" },
  { value: "15", key: "counts.15" },
];

export const DIFFICULTIES: Option[] = [
  { value: "easy", key: "difficulty.easy" },
  { value: "medium", key: "difficulty.medium" },
  { value: "hard", key: "difficulty.hard" },
  { value: "mixed", key: "difficulty.mixed" },
];

export const DIFFICULTY_TAGS: Option[] = [
  { value: "foundational-gaps", key: "difficultyTags.foundational-gaps" },
  { value: "reading-comprehension", key: "difficultyTags.reading-comprehension" },
  { value: "problem-solving", key: "difficultyTags.problem-solving" },
  { value: "vocabulary", key: "difficultyTags.vocabulary" },
  { value: "procedural-fluency", key: "difficultyTags.procedural-fluency" },
  { value: "exam-anxiety", key: "difficultyTags.exam-anxiety" },
];

/** The plain-number labels for the count control are the same in both languages. */
export function countLabel(value: string): string {
  return value;
}

/**
 * Which inputs each tool shows, in order.
 *
 * Declared as data so the form component has one loop rather than three
 * hand-written forms, and so a new tool is a registry entry plus a list here.
 */
export type FieldKind = "select" | "multi" | "number-range" | "text" | "textarea";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Label key under `tools.<toolKey>`. */
  labelKey: string;
  /** Option group under `tools`. */
  options?: Option[];
  hintKey?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface ToolSpec {
  id: "lesson-plan" | "questions" | "remedial-plan";
  /** Label and description live under `tools.<toolKey>`. */
  toolKey: string;
  fields: FieldSpec[];
}

export const TOOL_SPECS: ToolSpec[] = [
  {
    id: "lesson-plan",
    toolKey: "lessonPlan",
    fields: [
      { name: "grade", kind: "select", labelKey: "grade", options: GRADES },
      { name: "subject", kind: "select", labelKey: "subject", options: SUBJECTS },
      { name: "duration", kind: "select", labelKey: "duration", options: DURATIONS },
      { name: "teachingStyles", kind: "multi", labelKey: "teachingStyles", options: TEACHING_STYLES },
      { name: "topic", kind: "text", labelKey: "topic", hintKey: "topicHint", maxLength: 120 },
    ],
  },
  {
    id: "questions",
    toolKey: "questions",
    fields: [
      { name: "grade", kind: "select", labelKey: "grade", options: GRADES },
      { name: "subject", kind: "select", labelKey: "subject", options: SUBJECTS },
      { name: "questionTypes", kind: "multi", labelKey: "questionTypes", options: QUESTION_TYPES },
      { name: "count", kind: "select", labelKey: "count", options: QUESTION_COUNTS },
      { name: "difficulty", kind: "select", labelKey: "difficulty", options: DIFFICULTIES },
      { name: "topic", kind: "text", labelKey: "topic", hintKey: "topicHint", maxLength: 120 },
    ],
  },
  {
    id: "remedial-plan",
    toolKey: "remedialPlan",
    fields: [
      { name: "grade", kind: "select", labelKey: "grade", options: GRADES },
      { name: "subject", kind: "select", labelKey: "subject", options: SUBJECTS },
      { name: "score", kind: "number-range", labelKey: "score", min: 0, max: 100 },
      { name: "difficultyTags", kind: "multi", labelKey: "difficultyTags", options: DIFFICULTY_TAGS },
      { name: "studentName", kind: "text", labelKey: "studentName", maxLength: 50 },
      { name: "notes", kind: "textarea", labelKey: "notes", hintKey: "notesHint", maxLength: 500 },
    ],
  },
];

export function getToolSpec(id: string): ToolSpec | undefined {
  return TOOL_SPECS.find((t) => t.id === id);
}

/** The Gradle-8-style default options for a tool, so a form starts valid. */
export function defaultOptions(tool: ToolSpec): Record<string, unknown> {
  const out: Record<string, unknown> = { outputLanguage: "ar" };
  for (const field of tool.fields) {
    if (field.kind === "select") out[field.name] = field.options?.[0]?.value;
    if (field.kind === "multi") out[field.name] = [field.options?.[0]?.value];
    if (field.kind === "number-range") out[field.name] = 60;
    if (field.kind === "text" || field.kind === "textarea") out[field.name] = "";
  }
  return out;
}
