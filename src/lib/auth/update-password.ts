/**
 * The rules for setting a new password, separated from the Server Action so they
 * can be tested with fakes.
 *
 * Three properties, each of which is a bug if it only exists in the UI:
 *
 *   1. A session is required. The page already redirects an anonymous visitor,
 *      but a Server Action is a public endpoint — it can be invoked without ever
 *      rendering that page, so the check has to be here too.
 *   2. The length rule is server-side. `minLength` on the input is a hint; the
 *      same schema the sign-up form uses is applied to whatever actually arrives.
 *   3. The password never leaves this function except into the provider call. It
 *      is not returned, not logged, and not put into an error message.
 */

import type { AuthCode } from "./types";

export type PasswordResult = { ok: true } | { ok: false; code: AuthCode };

export interface ApplyPasswordArgs {
  /** Raw value from the form. Untrusted, may be any type. */
  rawPassword: unknown;
  /** Resolves the current user. Returns null when nobody is signed in. */
  getUser: () => Promise<{ user: { id: string } | null }>;
  /** Writes the new password. The only consumer of the value. */
  updateUser: (password: string) => Promise<{ error: { message: string } | null }>;
  /** Provider message -> stable code. Injected so nothing provider-shaped leaks. */
  mapError: (message: string | undefined) => AuthCode;
  /** The schema's validator, so the rule lives in exactly one place. */
  validate?: (value: unknown) => boolean;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/** The server-side length rule, matching `passwordSchema` in ./types. */
export function isAcceptablePassword(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length >= MIN_LENGTH &&
    value.length <= MAX_LENGTH
  );
}

export async function applyNewPassword(args: ApplyPasswordArgs): Promise<PasswordResult> {
  const validate = args.validate ?? isAcceptablePassword;
  if (!validate(args.rawPassword)) return { ok: false, code: "invalid_input" };

  // Checked before the write, so an anonymous caller learns nothing about
  // whether a user exists and cannot reach `updateUser` at all.
  const { user } = await args.getUser();
  if (!user) return { ok: false, code: "unauthorized" };

  const password = args.rawPassword as string;
  const { error } = await args.updateUser(password);
  if (error) {
    // Only the mapped code travels; the provider message may echo request data.
    return { ok: false, code: args.mapError(error.message) };
  }

  return { ok: true };
}