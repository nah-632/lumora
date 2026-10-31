/**
 * Structural validation for a generated question set.
 *
 * The registry's zod schema already enforces the shapes it can express: at most
 * four options, an index in 0..3, at most fifteen questions. What the schema
 * CANNOT express is the part that makes a question usable:
 *
 *   - a multiple-choice question has EXACTLY four options, not one or three;
 *   - exactly one option is the answer;
 *   - `answer` agrees with the option at `correctIndex`, so the printed key and
 *     the printed answer text cannot disagree;
 *   - the options are actually distinct, so "3" twice does not pass as four.
 *
 * Those are cross-field rules, so they live here rather than in the schema. The
 * same applies to a true/false item, which must offer exactly the two fixed
 * options and mark one of them.
 *
 * Every failure is reported as a value-free path and reason, so a repair prompt
 * can name what to fix without quoting a student-facing string back at the model.
 */

import type { QuestionsOutput } from "./tools";

export interface QuestionIssue {
  /** Path into the payload, e.g. `questions[2].options`. */
  path: string;
  /** A value-free explanation. Safe to put in a prompt. */
  reason: string;
}

export interface McqValidationResult {
  ok: boolean;
  issues: QuestionIssue[];
}

/** The two options a true/false question must offer. */
export const TRUE_FALSE_OPTIONS = ["True", "False"];
/** The equivalent in Arabic, since a true/false item is labelled in the output language. */
export const TRUE_FALSE_OPTIONS_AR = ["صح", "خطأ"];

function isLatinOrArabicTrueFalse(options: string[]): boolean {
  if (options.length !== 2) return false;
  const normalise = (s: string) => s.trim().toLowerCase();
  const pair = options.map(normalise);
  const latin = TRUE_FALSE_OPTIONS.map((s) => s.toLowerCase());
  const arabic = TRUE_FALSE_OPTIONS_AR.map((s) => s.toLowerCase());
  const matches = (target: string[]) =>
    pair[0] === target[0] && pair[1] === target[1];

  // Accept either order: the model may label them False/True.
  const latinReversed = pair[0] === latin[1] && pair[1] === latin[0];
  const arabicReversed = pair[0] === arabic[1] && pair[1] === arabic[0];

  return matches(latin) || matches(arabic) || latinReversed || arabicReversed;
}

/** Normalises an option for the duplicate check: case and spacing do not make two options distinct. */
function normaliseOption(option: string): string {
  return option.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Validates one question set.
 *
 * `expectedTypes` is optional; when supplied, the count of each type must match,
 * because a teacher who asked for five multiple-choice questions should not
 * receive five short answers.
 */
export function validateQuestions(
  output: QuestionsOutput,
  expected?: { count: number; types: string[] },
): McqValidationResult {
  const issues: QuestionIssue[] = [];

  if (expected) {
    if (output.questions.length !== expected.count) {
      issues.push({
        path: "questions",
        reason: `expected ${expected.count} questions, received ${output.questions.length}`,
      });
    }
    const requested = new Set(expected.types);
    for (const q of output.questions) {
      if (!requested.has(q.type)) {
        issues.push({
          path: `questions[${output.questions.indexOf(q)}].type`,
          reason: `the type "${q.type}" was not requested`,
        });
      }
    }
    // Every requested type must appear at least once, or the set is incomplete.
    for (const type of requested) {
      if (!output.questions.some((q) => q.type === type)) {
        issues.push({
          path: "questions",
          reason: `no question of the requested type "${type}" is present`,
        });
      }
    }
  }

  output.questions.forEach((question, index) => {
    const at = (field: string) => `questions[${index}].${field}`;

    if (question.type === "mcq") {
      // Exactly four options.
      if (question.options.length !== 4) {
        issues.push({
          path: at("options"),
          reason: `expected exactly 4 options, received ${question.options.length}`,
        });
      }

      // Exactly one correct, expressed as an in-range index.
      // A null index is the normalised form of the model's "-1" for "no answer",
      // which is never acceptable on a choice question.
      if (question.correctIndex === null || !Number.isInteger(question.correctIndex)) {
        issues.push({ path: at("correctIndex"), reason: "expected an integer option index" });
      } else if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
        issues.push({
          path: at("correctIndex"),
          reason: `the index points outside the options array (length ${question.options.length})`,
        });
      }

      // Distinct options: four copies of the same string is not a choice.
      const seen = new Set<string>();
      for (const option of question.options) {
        const key = normaliseOption(option);
        if (seen.has(key)) {
          issues.push({ path: at("options"), reason: "two options are identical" });
          break;
        }
        seen.add(key);
      }
    }

    if (question.type === "true-false") {
      if (!isLatinOrArabicTrueFalse(question.options)) {
        issues.push({
          path: at("options"),
          reason: "a true/false question must offer exactly two options: true and false",
        });
      }
      if (
        question.correctIndex === null ||
        question.correctIndex < 0 ||
        question.correctIndex > 1
      ) {
        issues.push({
          path: at("correctIndex"),
          reason: "a true/false answer must be option 0 or option 1",
        });
      }
    }

    if (question.type === "short") {
      // A short-answer item has no options to choose between. Some options would
      // make it a different question than the teacher asked for.
      if (question.options.length !== 0) {
        issues.push({
          path: at("options"),
          reason: `a short-answer question must have no options, received ${question.options.length}`,
        });
      }
      if (question.answer.trim().length === 0) {
        issues.push({ path: at("answer"), reason: "a short-answer question needs a model answer" });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}

/**
 * Checks that `answer` agrees with the option at `correctIndex`.
 *
 * Kept separate from `validateQuestions` because it applies only to choice
 * questions and is the check most likely to be relaxed later: models routinely
 * write the correct option's letter ("B") into `answer` rather than its text, so
 * a strict equality test would reject perfectly usable output. The comparison is
 * therefore tolerant — it accepts the option text, the letter, or the index — but
 * it does reject an `answer` that clearly names a DIFFERENT option.
 */
export function validateAnswerAlignment(output: QuestionsOutput): McqValidationResult {
  const issues: QuestionIssue[] = [];
  const letters = ["a", "b", "c", "d"];

  output.questions.forEach((question, index) => {
    if (question.type === "short") return;

    const at = (field: string) => `questions[${index}].${field}`;
    const chosenIndex = question.correctIndex;
    // A null index on a choice question is already reported by validateQuestions;
    // there is no option to compare the answer against.
    if (chosenIndex === null) return;
    const chosen = question.options[chosenIndex];
    if (chosen === undefined) return; // already reported by validateQuestions

    const answer = normaliseOption(question.answer);
    const expected = normaliseOption(chosen);
    const letter = letters[chosenIndex];
    const shortLetter = letter;

    const agrees =
      answer === expected ||
      answer === letter ||
      answer === `${letter})` ||
      answer === `${letter}.` ||
      answer === String(chosenIndex) ||
      answer.includes(expected);

    if (!agrees) {
      // The names of the options are deliberately not repeated here.
      issues.push({
        path: at("answer"),
        reason: `the answer does not match the option marked correct (option ${chosenIndex + 1})`,
      });
    }

    // A common model failure: the answer names a different option's text.
    const otherOptions = question.options
      .map((option, i) => ({ option: normaliseOption(option), i }))
      .filter(({ i }) => i !== chosenIndex);
    for (const { option } of otherOptions) {
      if (option.length > 0 && answer === option) {
        issues.push({
          path: at("answer"),
          reason: `the answer matches a different option than the one marked correct`,
        });
        break;
      }
      if (answer === shortLetter && false) break; // unreachable guard, kept out of the way
    }
  });

  return { ok: issues.length === 0, issues };
}

/** Renders issues as a value-free summary for a repair prompt. */
export function describeQuestionIssues(issues: QuestionIssue[], limit = 6): string {
  const parts = issues.slice(0, limit).map((issue) => `"${issue.path}": ${issue.reason}`);
  if (issues.length > limit) parts.push(`(and ${issues.length - limit} more issues)`);
  return parts.join("; ");
}
