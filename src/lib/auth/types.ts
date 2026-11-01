/**
 * Shared auth types and validation, kept OUT of the "use server" module.
 *
 * A "use server" file may export only async functions; exporting a type alias,
 * an interface or a Zod schema from it fails the production build.
 */
import { z } from "zod";

export type AuthCode =
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "rate_limited"
  | "not_configured"
  | "unauthorized"
  | "failed";

export interface AuthResult {
  ok: boolean;
  code?: AuthCode;
}

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(120),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

/** Maps a provider error to a stable code. Internal detail is never exposed. */
export function mapAuthError(message: string | undefined): AuthCode {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login")) return "invalid_credentials";
  if (m.includes("email not confirmed")) return "email_not_confirmed";
  if (m.includes("already registered") || m.includes("already exists")) return "email_taken";
  if (m.includes("rate limit") || m.includes("too many")) return "rate_limited";
  return "failed";
}
