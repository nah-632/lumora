/**
 * Direction and language attributes for the result document.
 *
 * Extracted from the component for one reason: this rule is the thing most
 * likely to be broken by a well-meaning refactor, and a pure function can be
 * tested across all four interface/draft combinations instead of being verified
 * by eye in two of them.
 *
 * THE RULE: the document's direction comes from the DRAFT's language. The
 * interface locale is irrelevant to it. A teacher reading an Arabic interface may
 * ask for an English lesson plan and vice versa; both are ordinary, and inheriting
 * the page direction in the mismatched case renders punctuation, numerals and any
 * mixed sentence at the wrong end of the line.
 */

export type Language = "ar" | "en";

export function directionFor(language: Language): "rtl" | "ltr" {
  return language === "ar" ? "rtl" : "ltr";
}

export interface DocumentAttributes {
  dir: "rtl" | "ltr";
  lang: Language;
}

/**
 * The attributes to place on the result container.
 *
 * `locale` is accepted so a caller can pass the interface locale without the
 * omission being silent, and it is deliberately unused: the signature documents
 * that the page language has no bearing on the document.
 */
export function documentAttributes({
  outputLanguage,
}: {
  outputLanguage: Language;
  locale?: Language;
}): DocumentAttributes {
  return { dir: directionFor(outputLanguage), lang: outputLanguage };
}
