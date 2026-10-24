/**
 * Server-side Supabase client factory.
 *
 * SECURITY: only the anon key plus the caller's own access token is ever used
 * here. The service_role key bypasses RLS and must never be reachable from a
 * request path that serves a teacher.
 */
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

/** Extracts the caller's access token from the request cookies. */
export function accessTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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
  const res = await fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
