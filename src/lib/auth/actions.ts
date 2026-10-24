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
import { revalidatePath } from "next/cache";
import { createSessionClient } from "./server";
import {
  signUpSchema,
  signInSchema,
  mapAuthError,
  emailSchema,
  type AuthResult,
} from "./types";

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

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, locale: parsed.data.locale } },
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

  const { error } = await supabase.auth.resetPasswordForEmail(email.data);
  // A reset request always reports success: revealing whether an address exists
  // would let anyone enumerate accounts.
  if (error && mapAuthError(error.message) === "rate_limited") {
    return { ok: false, code: "rate_limited" };
  }
  return { ok: true };
}
