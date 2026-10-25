/**
 * Server-side Supabase helpers shared by the API routes.
 *
 * SECURITY: only the anon key plus the caller's own session is ever used here.
 * The service_role key bypasses RLS and must never be reachable from a request
 * path that serves a teacher.
 *
 * Authentication goes through @supabase/ssr, exactly like the pages do. An
 * earlier version parsed a cookie named `sb-access-token` by hand; that cookie
 * does not exist — @supabase/ssr stores the session under
 * `sb-<project-ref>-auth-token` — so the token was always missing and the
 * "authenticated" branch of every route was unreachable.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Resolves the caller from the request session using the same cookie handling
 * as the rest of the app. Returns null when nobody is signed in.
 *
 * `getUser()` asks the Auth server, so a forged or expired token is rejected;
 * it never trusts a token merely because it decodes.
 */
export async function requireUser(): Promise<{ user: User; token: string } | null> {
  const env = readSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers may set cookies, but a refreshed token is written by
        // the middleware on the next navigation. Nothing to do here.
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return null;

  return { user: data.user, token };
}

/**
 * Minimal PostgREST call that carries the caller's token, so RLS — not this
 * code — decides what the teacher may see.
 */
export async function restRequest(
  env: SupabaseEnv,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.anonKey,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    // A network failure is not a client error and must never surface internals.
    return { ok: false, status: 502, data: null };
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}