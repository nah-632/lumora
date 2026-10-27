/**
 * Server-side session guards.
 *
 * Protection lives here and in RLS — never in hidden UI. A page that should not
 * be reachable without a session redirects; it does not render a blank shell.
 */
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./server";

export type Locale = "ar" | "en";

/** Redirects to the sign-in page, preserving the requested locale. */
export function redirectToSignIn(locale: Locale, returnTo?: string): never {
  const base = `/${locale}/sign-in`;
  const url = returnTo ? `${base}?next=${encodeURIComponent(returnTo)}` : base;
  redirect(url);
}

/** Requires a session or redirects. Use in every protected Server Component. */
export async function requireUser(locale: Locale, returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirectToSignIn(locale, returnTo);
  return user;
}

/** Requires one of the given roles, in addition to a session. */
export async function requireRole(
  locale: Locale,
  roles: string[],
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(locale, returnTo);
  if (!roles.some((r) => user.roles.includes(r))) {
    redirect(`/${locale}/not-authorised`);
  }
  return user;
}
