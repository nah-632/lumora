/**
 * GET /auth/callback — finishes an email link.
 *
 * Supabase sends the visitor back with a `code` after they click a confirmation
 * or recovery link. The code must be exchanged server-side, because the exchange
 * needs the PKCE verifier that @supabase/ssr keeps in a cookie. Nothing in this
 * app did that, so every email link landed as an anonymous visitor.
 *
 * The decision logic lives in `callback-core.ts` so it can be tested against a
 * fake exchange; this file is the plumbing that turns its result into a response.
 *
 * THE COOKIE RULE, and the reason this response object is created BEFORE the
 * exchange: the session cookies must be set on the SAME response that carries
 * the redirect. Writing them through `cookies()` and then returning a separate
 * `NextResponse.redirect()` produces a redirect without the session, which the
 * visitor experiences as "the link did nothing at all".
 *
 * Deliberately outside `/[locale]` and matched as infrastructure by the
 * middleware: it is a redirect target, not a page, and rewriting it to
 * `/ar/auth/callback` would 404 the link Supabase just sent.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/server/supabase";
import { completeCallback, type CookieToSet } from "@/lib/auth/callback-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");
  const env = readSupabaseEnv();

  if (!env) {
    return NextResponse.redirect(new URL("/ar/sign-in", url.origin));
  }

  const outcome = await completeCallback({
    code,
    next: nextRaw,
    exchange: async (exchangeCode, sink) => {
      const supabase = createServerClient(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Buffered: the redirect target is not known until the exchange
            // resolves, so the response does not exist yet.
            sink(cookiesToSet as CookieToSet[]);
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(exchangeCode);
      return { error: error ?? null };
    },
  });

  const response = NextResponse.redirect(new URL(outcome.nextPath, url.origin));
  for (const { name, value, options } of outcome.cookies) {
    response.cookies.set(name, value, options as never);
  }

  return response;
}