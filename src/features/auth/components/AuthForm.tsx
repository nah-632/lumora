"use client";

import { useActionState } from "@/lib/react/useActionState";
import type { AuthResult } from "@/lib/auth/types";

type Mode = "sign-in" | "sign-up" | "reset";

interface Props {
  mode: Mode;
  locale: "ar" | "en";
  labels: Record<string, string>;
  /** A plain form action. useActionState calls it with (prevState, formData),
   *  which this component adapts so callers pass the Server Action directly. */
  action: (formData: FormData) => Promise<AuthResult>;
  next?: string;
}

/**
 * One form for all three auth modes. Errors are announced with role="alert" and
 * named in the user's language; a raw provider message is never shown.
 */
export function AuthForm({ mode, locale, labels, action, next }: Props) {
  // useActionState supplies (prevState, formData); the Server Action takes only
  // formData, so it is adapted here and callers pass the action directly.
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => action(formData),
    null,
  );

  const errorText =
    state && !state.ok && state.code ? labels[`err_${state.code}`] ?? labels.err_failed : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "sign-up" && (
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium">{labels.fullName}</label>
          <input
            id="fullName" name="fullName" required maxLength={120} autoComplete="name"
            className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">{labels.email}</label>
        <input
          id="email" name="email" type="email" required maxLength={254}
          autoComplete="email" dir="ltr"
          className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
        />
      </div>

      {mode !== "reset" && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium">{labels.password}</label>
          <input
            id="password" name="password" type="password" required
            minLength={mode === "sign-up" ? 8 : 1} maxLength={128}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            dir="ltr"
            className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
          />
          {mode === "sign-up" && (
            <p className="mt-1 text-xs text-[var(--lumora-ink-soft)]">{labels.passwordHint}</p>
          )}
        </div>
      )}

      {state?.ok && mode === "reset" && (
        <p role="status" className="rounded-sm bg-success/10 px-3 py-2 text-sm text-success">
          {labels.resetSent}
        </p>
      )}
      {state?.ok && mode === "sign-up" && (
        <p role="status" className="rounded-sm bg-info/10 px-3 py-2 text-sm text-info">
          {labels.checkEmail}
        </p>
      )}

      {errorText && (
        <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-[#B3261E]">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-red px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
      >
        {pending ? labels.working : labels[`submit_${mode}`]}
      </button>
    </form>
  );
}
