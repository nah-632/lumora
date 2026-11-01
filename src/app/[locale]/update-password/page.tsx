import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { requireUser } from "@/lib/auth/guards";
import { updatePasswordAction } from "@/lib/auth/actions";

// Reached with a session minted by the recovery link, so it must never be
// prerendered: there is no session at build time and the guard would redirect.
export const dynamic = "force-dynamic";

/**
 * Where a password-recovery link ends up.
 *
 * /auth/callback exchanges the code for a session and redirects here, which is
 * why this page can require a user: without the exchange there is no session and
 * the guard sends the visitor to sign-in rather than showing a form that would
 * fail on submit.
 */
export default async function UpdatePasswordPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  await requireUser(locale, `/${locale}/update-password`);
  const t = await getTranslations({ locale, namespace: "auth" });

  const labels = Object.fromEntries(
    [
      "updateTitle", "password", "passwordHint", "submit_update", "updated", "signInTitle",
      "err_invalid_input", "err_rate_limited", "err_not_configured", "err_unauthorized",
      "err_failed",
    ].map((k) => [k, t(k)]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <LumoraMark locale={locale} href={`/${locale}`} size={40} withWordmark />
      <h1 className="text-2xl font-semibold text-navy">{t("updateTitle")}</h1>
      <div className="mt-6">
        <AuthForm mode="update" locale={locale} labels={labels} action={updatePasswordAction} />
      </div>
      <p className="mt-6 text-sm text-[var(--lumora-ink-soft)]">
        <Link href={`/${locale}/students`} className="underline underline-offset-2">
          {t("continueToDashboard")}
        </Link>
      </p>
    </main>
  );
}