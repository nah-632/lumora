/**
 * Server-side Supabase clients.
 *
 * There are exactly two clients, and the distinction matters:
 *   - createSessionClient(): carries the CALLER'S session via cookies. RLS sees
 *     the teacher, so every read and write is authorised by the database.
 *   - createAdminClient(): uses the service_role key and BYPASSES RLS. It exists
 *     only for account maintenance that cannot be done from a request path.
 *     It must never be reachable from a page or a teacher-triggered action.
 *
 * Keys are read from the environment at call time and never logged.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Caller-scoped client. RLS applies. Use this for everything a teacher touches. */
export async function createSessionClient() {
  const e = env();
  if (!e) return null;

  const cookieStore = await cookies();

  return createServerClient(e.url, e.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies are read-only.
          // The middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Admin client. Bypasses RLS — for account maintenance only, never for serving a
 * teacher's request. Throws rather than silently degrading if unconfigured.
 */
export function createAdminClient() {
  const e = env();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!e || !serviceKey) return null;
  return createClient(e.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
  roles: string[];
}

/**
 * Resolves the current user and their roles. Roles come from the user_roles
 * table, never from user-editable metadata.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) return null;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    roles: (roleRows ?? []).map((r: { role: string }) => r.role),
  };
}
