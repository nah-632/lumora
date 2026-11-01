"use server";

/**
 * Authentication Server Actions.
 *
 * Every action returns a typed result rather than throwing, so the UI can show a
 * specific bilingual message. Raw provider errors are never surfaced.
 *
 * This module exports ASYNC FUNCTIONS ONLY — a "use server" file cannot export
 * types, interfaces or schemas. Those live in ./types.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "./server";
import { callbackUrl } from "./redirect";
import { resolveAuthOrigin } from "./origin";
import { applyNewPassword } from "./update-password";
import {
  signUpSchema,
  signInSchema,
  mapAuthError,
  emailSchema,
  passwordSchema,
  type AuthResult,
} from "./types";

/**
 * The origin Supabase should send a link back to.
 *
 * The headers are read only to learn what the request CLAIMS; they do not decide
 * the answer. `resolveAuthOrigin` accepts the claim only when it appears in
 * AUTH_ALLOWED_ORIGINS, so a forged Host cannot make a recovery link point at an
 * attacker's domain. Anything unlisted falls back to NEXT_PUBLIC_SITE_URL.
 *
 * Both variables are deployment configuration, not secrets.
 */
async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${proto}://${host}` : null;

  return resolveAuthOrigin({
    requestOrigin,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    allowed: process.env.AUTH_ALLOWED_ORIGINS,
  });
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    locale: formData.get("locale") ?? "ar",
  });
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, code: "not_configured" };

  // Without this the confirmation link goes to the project's Site URL and the
  // code is never exchanged, so the new account can never sign in.
  const origin = await siteOrigin();
  const emailRedirectTo = origin
    ? callbackUrl(origin, `/${parsed.data.locale}/students`)
    : undefined;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale: parsed.data.locale },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });
  if (error) return { ok: false, code: mapAuthError(error.message) };

  // With email confirmation required there is no session yet; the page explains
  // what to do rather than appearing to have failed.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: true };
  redirect(`/${parsed.data.locale}/students`);
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, code: "invalid_input" };

  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, code: "not_configured" };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, code: mapAuthError(error.message) };

  const locale = String(formData.get("locale") ?? "ar");
  const next = String(formData.get("next") ?? `/${locale}/students`);
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : `/${locale}/students`);
}

export async function signOutAction(locale: string): Promise<void> {
  const supabase = await createSessionClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale === "en" ? "en" : "ar"}/sign-in`);
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthResult> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, code: "invalid_input" };

  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, code: "not_configured" };

  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const origin = await siteOrigin();
  const redirectTo = origin ? callbackUrl(origin, `/${locale}/update-password`) : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.data,
    redirectTo ? { redirectTo } : undefined,
  );
  // A reset request always reports success: revealing whether an address exists
  // would let anyone enumerate accounts.
  if (error && mapAuthError(error.message) === "rate_limited") {
    return { ok: false, code: "rate_limited" };
  }
  return { ok: true };
}

/**
 * Sets a new password for the signed-in user.
 *
 * Reached only after /auth/callback has exchanged a recovery link for a session,
 * which is what makes "forgot password" finishable: the email link establishes
 * the session, and this writes the new password into it.
 */
export async function updatePasswordAction(formData: FormData): Promise<AuthResult> {
  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, code: "not_configured" };

  // The rules live in update-password.ts so they can be tested with fakes. This
  // function is the plumbing: it forwards the raw value and the client, and
  // maps the result. Nothing here reads, keeps or logs the password.
  const result = await applyNewPassword({
    rawPassword: formData.get("password"),
    getUser: async () => {
      const { data } = await supabase.auth.getUser();
      return { user: data.user ? { id: data.user.id } : null };
    },
    updateUser: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error ? { message: error.message } : null };
    },
    mapError: mapAuthError,
    validate: (value) => passwordSchema.safeParse(value).success,
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}
