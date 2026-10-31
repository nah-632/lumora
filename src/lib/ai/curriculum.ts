/**
 * Retrieval and output post-processing for curriculum grounding.
 *
 * Split from `generate.ts` on purpose. That module builds a prompt from
 * validated teacher input and knows nothing about the database; this module
 * knows about the database and nothing about the model. The route composes them.
 *
 * THE ONE RULE THIS MODULE ENFORCES: the model never sees a URL, and the model
 * never produces one that reaches a teacher.
 *
 *   Read path   — `search_curriculum_text()` returns `source_url` because the
 *                 caller needs it. `toPromptText()` drops it before the value
 *                 reaches the prompt. Retrieval returns URLs; the prompt builder
 *                 discards them.
 *   Write path  — `stripModelUrls()` removes any URL the model emitted anyway,
 *                 and `buildReferences()` appends a references block assembled
 *                 from the database rows, not from the reply.
 *
 * Both halves are needed. Stripping alone would leave the reply with a source
 * claim and no source; appending alone would leave the model's own invented
 * links in the body. Together, every URL a teacher sees came out of a row that
 * has a `verified_at`.
 */

import {
  GENERAL_STANDARDS_DISCLAIMER,
  renderCurriculumBlock,
  type OutputLanguage,
} from "./prompts/curriculum-expert";

/* -------------------------------------------------------------------------- */
/* Retrieval result                                                           */
/* -------------------------------------------------------------------------- */

/**
 * One row from `search_curriculum_text()`.
 *
 * `sourceUrl` is present because the route appends it to the references block.
 * It is deliberately absent from `CurriculumPromptText`, the type the prompt
 * builder accepts, so passing it into a prompt is a type error rather than a
 * code review question.
 */
export interface CurriculumMatch {
  documentId: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  lessonTopic: string | null;
  unitNumber: number | null;
  textContent: string;
}

/** The projection that is allowed anywhere near a model call. */
export interface CurriculumPromptText {
  sourceTitle: string;
  textContent: string;
}

/** The narrow slice of the database client this module needs. */
export interface CurriculumQuery {
  search(args: {
    subject: string;
    gradeLevel: number;
    lessonTopic: string | null;
    term: number | null;
    limit: number;
  }): Promise<CurriculumMatch[]>;
}

/* -------------------------------------------------------------------------- */
/* Prompt assembly                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Drops the URL. This is the whole function, and it is the point of the file.
 *
 * Written as an explicit projection rather than a spread-minus-key because
 * `{...m, sourceUrl: undefined}` still carries the property, and a later
 * `Object.entries` over it would find it.
 */
export function toPromptText(matches: CurriculumMatch[]): CurriculumPromptText[] {
  return matches.map((m) => ({
    sourceTitle: m.sourceTitle,
    textContent: m.textContent,
  }));
}

export interface CurriculumContext {
  /** The block to append to the user message. */
  block: string;
  /** True when real text was found. Drives the system prompt variant. */
  hasText: boolean;
  /** Kept for the references block. Never enters the prompt. */
  matches: CurriculumMatch[];
}

/**
 * Builds the `<curriculum_text>` block for a request.
 *
 * Returns `hasText: false` and the `source="none"` block when retrieval found
 * nothing, which is the honest default and the case that occurs today.
 */
export function buildCurriculumContext(matches: CurriculumMatch[]): CurriculumContext {
  const withText = matches.filter((m) => m.textContent.trim() !== "");
  if (withText.length === 0) {
    return { block: renderCurriculumBlock(null, "none"), hasText: false, matches: [] };
  }

  // Joined with a separator that cannot be mistaken for the text itself, and
  // each document's own title is NOT included: a title is a claim about a book,
  // and a model given "Grade 8 Mathematics, Term 2" will happily describe the
  // book from its prior. Only the outcome text crosses.
  const text = withText.map((m) => m.textContent).join("\n\n---\n\n");
  return { block: renderCurriculumBlock(text, "official"), hasText: true, matches: withText };
}

/* -------------------------------------------------------------------------- */
/* URL stripping                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Matches a bare URL or a markdown link, in the shapes a model actually emits.
 *
 * Order matters: the markdown-link alternative runs first, so `[text](url)`
 * loses the whole link rather than leaving an orphan `[text](`.
 */
const URL_PATTERN =
  /\[([^\]]{0,120})\]\(\s*https?:\/\/[^\s)]+\s*\)|https?:\/\/[^\s<>"'\)\]]+/gi;

/**
 * A domain without a scheme, e.g. "moe.gov.bh" or "www.edunet.bh".
 *
 * Deliberately narrow. A loose pattern would eat "Math.Unit" or a decimal in a
 * sentence, and a lesson plan with mangled numbers is worse than one with a
 * stray domain. This requires a known TLD-shaped ending and at least one dot.
 */
const BARE_DOMAIN_PATTERN =
  /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:bh|com|org|net|edu|gov|io|info|sch)\b(?:\/[^\s<>"'\)\]]*)?/gi;

export interface StripResult {
  text: string;
  /** How many URLs were removed. The count is logged; the URLs are not. */
  removed: number;
}

/**
 * Removes every URL the model produced.
 *
 * The count is returned so the route can log the FACT that a URL was emitted —
 * which is a signal that the prompt is being ignored — without logging the URL
 * itself, which would put a model-invented destination into a log file and make
 * it look like a real reference.
 *
 * Markdown links are degraded to their label rather than deleted outright: a
 * sentence reading "see the Ministry guide on fractions" survives as a sentence,
 * where deleting the whole link would leave a hole.
 */
export function stripModelUrls(text: string): StripResult {
  let removed = 0;

  let out = text.replace(URL_PATTERN, (_match, label: string | undefined) => {
    removed += 1;
    return label && label.trim() !== "" ? label : "";
  });

  out = out.replace(BARE_DOMAIN_PATTERN, () => {
    removed += 1;
    return "";
  });

  // Collapse the whitespace the removals left behind, and tidy a space before
  // punctuation that a removal at the end of a clause would otherwise leave.
  out = out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,;:!?])/g, "$1");
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  return { text: out, removed };
}

/* -------------------------------------------------------------------------- */
/* References block                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The references a teacher sees, assembled from the database.
 *
 * `sourceUrl` comes from `curriculum_sources.base_url` on a row that has a
 * `verified_at`. That is the entire authority of this block: it is not derived
 * from model output, and a model that hallucinated a source cannot add a line to
 * it.
 *
 * Returns "" when there is nothing to cite — the honest case when the output is
 * a general-standards answer. A "no sources" heading would imply a search
 * happened and came up empty, which is not the same claim.
 */
export function buildReferences(matches: CurriculumMatch[], language: OutputLanguage): string {
  const cited = matches.filter((m) => m.sourceUrl && m.sourceUrl.trim() !== "");
  if (cited.length === 0) return "";

  // Deduplicated by source: several documents from one book are one reference.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const m of cited) {
    const url = m.sourceUrl!.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    // A plain-text URL is the whole point of a reference block: it lets a teacher
    // tap through to the verified source. It is deliberately included here —
    // read from the database rows — and deliberately excluded from the PROMPT
    // (see `toPromptText`), so the model sees text, the teacher sees a link, and
    // the two can never be confused.
    if (language === "ar") {
      const unit = m.unitNumber !== null ? `، الوحدة ${m.unitNumber}` : "";
      lines.push(`- ${m.sourceTitle}${unit} — ${url}`);
    } else {
      const unit = m.unitNumber !== null ? `, unit ${m.unitNumber}` : "";
      lines.push(`- ${m.sourceTitle}${unit} — ${url}`);
    }
  }

  const heading = language === "ar" ? "المصادر" : "References";
  return `\n\n---\n\n**${heading}**\n\n${lines.join("\n")}`;
}

/**
 * Whether the output needs the "general standards" label.
 *
 * The system prompt instructs the model to emit the sentence itself when there
 * is no context, and in the measured runs it does. This is the server-side
 * backstop for when it does not: the rule the product promises is that an
 * ungrounded output SAYS it is ungrounded, and a rule that depends on a model
 * complying is not a rule.
 */
export function ensureGroundingLabel(
  text: string,
  hasCurriculumText: boolean,
  language: OutputLanguage,
): string {
  if (hasCurriculumText) return text;

  const disclaimer = GENERAL_STANDARDS_DISCLAIMER[language];
  if (text.includes(disclaimer)) return text;

  return `${disclaimer}\n\n${text}`;
}
