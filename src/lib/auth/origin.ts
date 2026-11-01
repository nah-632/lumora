/**
 * Which origin an auth email is allowed to come back to.
 *
 * THE PROBLEM: `signUp` and `resetPasswordForEmail` need an absolute URL that
 * Supabase will redirect to, and the natural source for it is the request — the
 * `Host` / `X-Forwarded-Host` headers. Those headers are attacker-controlled on
 * any deployment that is not behind a proxy that overwrites them. Deriving the
 * redirect target from them means a request with a forged `Host` can produce an
 * email whose link points at the attacker's domain, with a valid recovery code
 * in it. That is account takeover with extra steps.
 *
 * THE RULE HERE: headers may only *select* an origin that is already on an
 * allow-list. They can never introduce one. If the claimed origin is not listed,
 * the configured site URL is used, and if that is missing too the caller gets
 * null and simply does not pass a redirect — Supabase then falls back to the
 * project's own Site URL, which is also safe.
 *
 * Comparing normalised origins (scheme + host + port, no trailing slash, no
 * path) means `https://Lumora.example/` and `https://lumora.example` match, while
 * `https://lumora.example.evil.test` does not.
 */

/** A usable origin, or null. Accepts only http/https with a host. */
export function normaliseOrigin(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  return `${url.protocol}//${url.host}`.toLowerCase();
}

/** Parses the comma-separated allow-list into normalised origins. */
export function parseOriginList(value: string | null | undefined): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  const out: string[] = [];
  for (const part of value.split(",")) {
    const origin = normaliseOrigin(part);
    if (origin && !out.includes(origin)) out.push(origin);
  }
  return out;
}

export interface AuthOriginInput {
  /** The origin the request claims, built from its headers. Untrusted. */
  requestOrigin?: string | null;
  /** NEXT_PUBLIC_SITE_URL — the default when the claim is not allowed. */
  siteUrl?: string | null;
  /** AUTH_ALLOWED_ORIGINS — comma separated. */
  allowed?: string | null;
}

/**
 * The origin an email link may point at.
 *
 * Order: the claimed origin ONLY if it is on the list, then the configured site
 * URL, then the first listed origin, then null.
 */
export function resolveAuthOrigin(input: AuthOriginInput): string | null {
  const allowed = parseOriginList(input.allowed);
  const site = normaliseOrigin(input.siteUrl);
  const claimed = normaliseOrigin(input.requestOrigin);

  if (claimed && allowed.includes(claimed)) return claimed;
  if (site) return site;
  if (allowed.length > 0) return allowed[0];
  return null;
}