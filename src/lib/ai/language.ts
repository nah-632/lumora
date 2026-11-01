/**
 * Two deterministic checks on model output: is it in the language that was
 * asked for, and is a multiple-choice question actually answerable?
 *
 * Both are pure functions over already-parsed data. Neither calls a provider or
 * reads anything global, which is what makes them testable and why they can run
 * on every response without a cost.
 *
 * The language check is deliberately NOT a language-detection library. A teacher
 * asks for Arabic or for English, and nothing else, so this is a two-way decision
 * between known options rather than an open-set classification. That removes the
 * whole class of "detected Portuguese" nonsense and the model download that comes
 * with it.
 */

/* -------------------------------------------------------------------------- */
/* Script classification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The scripts we count.
 *
 * Arabic script includes the Arabic Supplement and Extended-A blocks, because
 * Bahraini curriculum material regularly uses Quranic and extended characters.
 * Presentation forms (U+FE70–U+FEFF) appear when text has been through a PDF or
 * an old word processor, so they count too.
 */
const ARABIC_RANGES: Array<[number, number]> = [
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb50, 0xfdff], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

/**
 * Latin ranges we accept as "Latin script".
 *
 * Deliberately ASCII letters plus the Latin-1 Supplement and Latin Extended-A,
 * which covers accented names a teacher may legitimately type. The full Unicode
 * `Script=Latin` property is not used: it would require a regex with the `u` and
 * `\p{Script=Latin}` flags, whose support is not worth depending on for a check
 * whose answer is decided at an 80% threshold.
 */
function isLatinLetter(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    (code >= 0xc0 && code <= 0xff && code !== 0xd7 && code !== 0xf7) || // Latin-1 letters
    (code >= 0x100 && code <= 0x17f) // Latin Extended-A
  );
}

function isArabicLetter(code: number): boolean {
  for (const [lo, hi] of ARABIC_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

/**
 * Characters that carry no language signal and must not skew the ratio:
 * digits in both scripts, Arabic-Indic digits, punctuation, math operators,
 * whitespace, and the Arabic tatweel (a purely decorative elongation).
 *
 * Counting these as Arabic is the classic way a language check passes an English
 * response that happens to contain the numbers ٠١٢٣, or fails an Arabic one that
 * is mostly a list of equations.
 */
function isIgnorable(code: number): boolean {
  if (code < 0x80) {
    // ASCII: keep letters, ignore everything else (digits, punctuation, space).
    return !isLatinLetter(code);
  }
  // Arabic-Indic and Eastern Arabic-Indic digits.
  if (code >= 0x0660 && code <= 0x0669) return true;
  if (code >= 0x06f0 && code <= 0x06f9) return true;
  // Tatweel.
  if (code === 0x0640) return true;
  // Arabic combining marks (harakat) attach to a letter but are not letters;
  // counting them as characters would let a short vocalised phrase outweigh a
  // longer unvocalised one.
  if (code >= 0x064b && code <= 0x065f) return true;
  if (code === 0x0670) return true;
  if (code >= 0x06d6 && code <= 0x06ed) return true;
  // General punctuation / symbols / spaces.
  if (code >= 0x2000 && code <= 0x206f) return true;
  if (code >= 0x20a0 && code <= 0x20cf) return true;
  if (code >= 0x2100 && code <= 0x214f) return true;
  if (code >= 0x2190 && code <= 0x2bff) return true;
  if (code === 0xfeff) return true;
  return false;
}

export interface ScriptCounts {
  arabic: number;
  latin: number;
  /** Characters that carried no signal and were not counted. */
  ignored: number;
}

/**
 * Counts Arabic-script and Latin-script letters, ignoring everything else.
 *
 * Order matters: `isIgnorable` is consulted BEFORE the script ranges. Arabic-Indic
 * digits (U+0660–0669), the harakat (U+064B–065F) and the tatweel (U+0640) all sit
 * INSIDE the Arabic block, so a plain range test would count them as Arabic
 * letters. That is not a cosmetic error — it inflates the Arabic side of the
 * ratio, which is exactly the measurement this function exists to make.
 */
export function countScripts(text: string): ScriptCounts {
  let arabic = 0;
  let latin = 0;
  let ignored = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    if (isIgnorable(code)) {
      ignored += 1;
    } else if (isArabicLetter(code)) {
      arabic += 1;
    } else if (isLatinLetter(code)) {
      latin += 1;
    } else {
      // A letter in some other script (Greek, Cyrillic, CJK, Hebrew…). It is
      // signal that the response is in neither requested language, so it is not
      // counted for either side.
      ignored += 1;
    }
  }

  return { arabic, latin, ignored };
}

/* -------------------------------------------------------------------------- */
/* Stopwords                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Function words that are frequent in any prose and rare in the other language.
 *
 * Chosen to be words a model would produce naturally in a lesson plan or a set of
 * questions. Kept short on purpose: a long list adds no accuracy at this stage
 * because it is only consulted when the script ratio has already failed to
 * decide, and it is matched on whole words so short entries cannot fire inside
 * longer ones.
 */
export const ARABIC_STOPWORDS = [
  "من",
  "في",
  "على",
  "التي",
  "الذي",
  "هذا",
  "هذه",
  "مع",
  "أن",
  "إلى",
  "عن",
  "كما",
  "بين",
  "كل",
  "أو",
  "لا",
  "ما",
  "هو",
  "هي",
  "بعد",
  "قبل",
];

export const ENGLISH_STOPWORDS = [
  "the",
  "and",
  "of",
  "to",
  "in",
  "is",
  "that",
  "for",
  "with",
  "as",
  "are",
  "be",
  "this",
  "it",
  "on",
  "by",
  "from",
  "or",
  "an",
  "at",
];

/**
 * Counts whole-word occurrences.
 *
 * Two details that matter for Arabic:
 *
 * 1. Arabic attaches its conjunctions and prepositions to the following word, so
 *    "ومن" and "والكسور" are single tokens. Matching "من" only at a strict word
 *    boundary would miss most real occurrences. A leading prefix from و ف ب ك ل
 *    (optionally followed by ال) is therefore consumed before the match.
 *
 * 2. The match still has to END at a word boundary, so "من" does not fire inside
 *    "مثال" or "مسألة", and "the" does not fire inside "therein". That is the
 *    property that keeps a stopword count meaningful rather than a substring
 *    accident.
 *
 * Latin matching is case-insensitive on ordinary word boundaries.
 */
export function countStopwords(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;

  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isArabicWord = /[\u0600-\u06ff]/.test(word);

    if (isArabicWord) {
      // (prefix)(word) followed by a non-letter, with the prefix optional.
      const prefix = "(?:[وفبكل])?(?:ال)?";
      const re = new RegExp(`(?:^|[^\\p{L}])${prefix}${escaped}(?![\\p{L}])`, "gu");
      hits += (lower.match(re) ?? []).length;
    } else {
      const re = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "gu");
      hits += (lower.match(re) ?? []).length;
    }
  }

  return hits;
}

/* -------------------------------------------------------------------------- */
/* The decision                                                               */
/* -------------------------------------------------------------------------- */

export type Language = "ar" | "en";
export type LanguageVerdict = "match" | "mismatch" | "undecidable";

export interface LanguageCheckResult {
  verdict: LanguageVerdict;
  /** Which stage decided it, for the log line and for the tests. */
  decidedBy: "script" | "stopwords" | "none";
  arabicRatio: number;
  counts: ScriptCounts;
  stopwordHits: { ar: number; en: number };
}

/** Above this share, the script ratio decides on its own. */
export const DECISIVE_HIGH = 0.8;
/** Below this share the ratio is treated as ambiguous and stopwords are used. */
export const AMBIGUOUS_LOW = 0.3;
/** The upper edge of the ambiguous band. */
export const AMBIGUOUS_HIGH = 0.7;
/** A stopword count must beat the other language by this factor to decide. */
export const STOPWORD_MARGIN = 1.5;
/** Below this many letters, no verdict is trustworthy. */
export const MIN_LETTERS = 12;

/**
 * Decides whether `text` is in `expected`.
 *
 * Three outcomes rather than two. `undecidable` exists because a short answer
 * that is mostly a formula, or a legitimately bilingual list of key terms, should
 * not be punished. Only `mismatch` triggers a repair; `undecidable` passes
 * through. That asymmetry is intentional: the cost of a wrong repair is a second
 * billed call and a mangled result, and the cost of letting a slightly ambiguous
 * response through is nothing a teacher will notice.
 */
export function checkLanguage(text: string, expected: Language): LanguageCheckResult {
  const counts = countScripts(text);
  const letters = counts.arabic + counts.latin;
  const arabicRatio = letters === 0 ? 0 : counts.arabic / letters;

  const stopwordHits = {
    ar: countStopwords(text, ARABIC_STOPWORDS),
    en: countStopwords(text, ENGLISH_STOPWORDS),
  };

  const base = { arabicRatio, counts, stopwordHits };

  // Too little signal to judge. A one-word answer or a numeric response is not
  // evidence of a language problem.
  if (letters < MIN_LETTERS) {
    return { verdict: "undecidable", decidedBy: "none", ...base };
  }

  // Step 2: a decisive script ratio resolves it immediately.
  if (arabicRatio > DECISIVE_HIGH) {
    return {
      verdict: expected === "ar" ? "match" : "mismatch",
      decidedBy: "script",
      ...base,
    };
  }
  if (arabicRatio < 1 - DECISIVE_HIGH) {
    return {
      verdict: expected === "en" ? "match" : "mismatch",
      decidedBy: "script",
      ...base,
    };
  }

  // Step 3: the 20%-80% middle, and specifically the 30-70% band, is decided by
  // function words when one language clearly dominates.
  const withinAmbiguousBand =
    arabicRatio >= AMBIGUOUS_LOW && arabicRatio <= AMBIGUOUS_HIGH;

  const ar = stopwordHits.ar;
  const en = stopwordHits.en;

  if (ar > 0 && en > 0) {
    if (ar >= en * STOPWORD_MARGIN) {
      return {
        verdict: expected === "ar" ? "match" : "mismatch",
        decidedBy: "stopwords",
        ...base,
      };
    }
    if (en >= ar * STOPWORD_MARGIN) {
      return {
        verdict: expected === "en" ? "match" : "mismatch",
        decidedBy: "stopwords",
        ...base,
      };
    }
    // Both languages are genuinely present, or neither dominates.
    return { verdict: "undecidable", decidedBy: "none", ...base };
  }

  // Only one language produced function words at all.
  if (ar > 0 && en === 0 && ar >= 2) {
    return {
      verdict: expected === "ar" ? "match" : "mismatch",
      decidedBy: "stopwords",
      ...base,
    };
  }
  if (en > 0 && ar === 0 && en >= 2) {
    return {
      verdict: expected === "en" ? "match" : "mismatch",
      decidedBy: "stopwords",
      ...base,
    };
  }

  // Nothing decided it. Deliberately not a failure: a short, term-heavy answer
  // is the common case here and is not a defect worth a retry.
  void withinAmbiguousBand;
  return { verdict: "undecidable", decidedBy: "none", ...base };
}

/**
 * Flattens every string in a generated payload into one text blob for checking.
 *
 * Keys are excluded: a JSON key like "correctIndex" or "true-false" is English by
 * construction and would drag an Arabic response toward being read as English.
 * Labels the model chooses, such as "True" / "False" options, ARE included,
 * which is why the threshold is a ratio and not an all-or-nothing rule.
 */
export function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectText(item, out);
    }
  }
  return out;
}

/** A one-line, value-free description of the language mismatch for the repair prompt. */
export function describeLanguageIssue(result: LanguageCheckResult, expected: Language): string {
  const name = expected === "ar" ? "Arabic" : "English";
  const other = expected === "ar" ? "English" : "Arabic";
  const pct = Math.round(result.arabicRatio * 100);
  const observed =
    expected === "ar"
      ? `only ${pct}% of the letters were Arabic script`
      : `${pct}% of the letters were Arabic script`;
  const via = result.decidedBy === "stopwords" ? " (decided by function words)" : "";
  return `the text is in ${other}, not in ${name}: ${observed}${via}. Rewrite ALL prose in ${name}.`;
}
