/**
 * Pure helpers for the auth callback redirect.
 *
 * Kept separate from the route so both rules can be unit-tested without a
 * request: what a `next` parameter is allowed to be, and how the callback URL is
 * built. A redirect target is attacker-controlled input in every flow that has
 * one, which is exactly the kind of thing that should not be verified by reading.
 */

const FALLBACK_LOCALE = "ar";

/**
 * Resolves a post-login destination.
 *
 * Only a same-site absolute path is accepted. `//host` and `/\host` are both
 * protocol-relative to a browser (the second one becomes `//host` after URL
 * parsing), so an allow-list of "starts with a slash" is not enough on its own.
 * Anything else collapses to the dashboard for the locale.
 */
export function safeNext(raw: string | null | undefined, locale: "ar" | "en" = FALLBACK_LOCALE): string {
  const fallback = `/${locale}/students`;
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Control characters can truncate or re-parse the target downstream.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

/**
 * Picks the locale for the fallback, from the `next` path when it names one.
 * Only used so a failed exchange lands on a page in the language the teacher was
 * already reading.
 */
export function localeFromNext(raw: string | null | undefined): "ar" | "en" {
  return typeof raw === "string" && /^\/en(\/|$)/.test(raw) ? "en" : FALLBACK_LOCALE;
}

/**
 * The absolute URL a Supabase email link should come back to.
 *
 * Supabase rejects a relative target, so the origin has to be resolved by the
 * caller (headers on the server, `window.location.origin` in the browser).
 */
export function callbackUrl(origin: string, next?: string): string {
  const base = `${origin.replace(/\/+$/, "")}/auth/callback`;
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}