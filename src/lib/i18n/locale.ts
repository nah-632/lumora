/**
 * Locale choice for an un-prefixed request.
 *
 * Extracted from the middleware so the rule can be tested without a request:
 * the root URL is the one path where a wrong answer is invisible (it redirects
 * somewhere valid either way) and expensive (a first impression).
 */

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "ar" || value === "en";
}

/**
 * Picks a locale from an `Accept-Language` header.
 *
 * Only the first preference is consulted, and only for English. Anything else —
 * a French browser, a malformed header, no header at all — gets Arabic, which is
 * the product's default rather than an accident of ordering.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (typeof acceptLanguage !== "string") return DEFAULT_LOCALE;
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : DEFAULT_LOCALE;
}