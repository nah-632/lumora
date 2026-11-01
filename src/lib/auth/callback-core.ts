/**
 * The decision half of /auth/callback, separated from Next so it can be tested.
 *
 * The route's job is three lines of plumbing: read the query, call this, write
 * the returned cookies onto the returned redirect. Everything that can be wrong
 * — a missing code, a failed exchange, a hostile `next` — is decided here, with
 * the exchange passed in as a function so a test can supply a fake client.
 *
 * The important shape is that cookies and the redirect target travel TOGETHER.
 * A callback that returns a redirect and separately mutates a cookie store is
 * how "the link does nothing" happens: the browser follows the redirect without
 * the session cookie and arrives signed out.
 */

import { localeFromNext, safeNext } from "./redirect";

export interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/** What the route needs to build its response. */
export interface CallbackOutcome {
  /** Path only; the route resolves it against the request origin. */
  nextPath: string;
  /** Cookies the exchange produced. Written onto the redirect response itself. */
  cookies: CookieToSet[];
  /** True when the visitor should be told the link did not work. */
  expired: boolean;
}

export interface CompleteCallbackArgs {
  code: string | null;
  next: string | null;
  /**
   * Performs the code exchange. `sink` receives the cookies the client wants to
   * set; a fake in tests calls it with a session cookie.
   */
  exchange: (
    code: string,
    sink: (cookies: CookieToSet[]) => void,
  ) => Promise<{ error: unknown | null }>;
}

export async function completeCallback(args: CompleteCallbackArgs): Promise<CallbackOutcome> {
  const locale = localeFromNext(args.next);

  // No code: nothing to exchange. This is what a hand-typed URL looks like, and
  // it is a sign-in prompt rather than an error page.
  if (!args.code) {
    return { nextPath: `/${locale}/sign-in`, cookies: [], expired: false };
  }

  const cookies: CookieToSet[] = [];
  const { error } = await args.exchange(args.code, (list) => {
    cookies.push(...list);
  });

  if (error) {
    // Expired, already used, or from another project. The sign-in page offers a
    // fresh link; the provider's message is never shown.
    return { nextPath: `/${locale}/sign-in?expired=1`, cookies: [], expired: true };
  }

  // safeNext decides; an unlisted or hostile target collapses to the dashboard.
  return { nextPath: safeNext(args.next, locale), cookies, expired: false };
}