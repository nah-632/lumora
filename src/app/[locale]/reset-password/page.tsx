import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { requestPasswordResetAction } from "@/lib/auth/actions";

// Every page here depends on the request (session cookie or locale), so it
// must never be prerendered. Without this Next attempts to render these at
// build time, where cookies() and the auth client are unavailable, and the
// prerender worker stalls.
export const dynamic = "force-dynamic";


export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  const labels = Object.fromEntries(
    [
      "email","working","resetTitle","submit_reset","resetSent",
      "err_invalid_input","err_rate_limited","err_not_configured","err_failed","signInTitle",
    ].map((k) => [k, t(k)]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <LumoraMark locale={locale} href={`/${locale}`} size={40} withWordmark />
      <h1 className="text-2xl font-semibold text-navy">{t("resetTitle")}</h1>
      <div className="mt-6">
        <AuthForm mode="reset" locale={locale} labels={labels} action={requestPasswordResetAction} />
      </div>
      <p className="mt-6 text-sm text-[var(--lumora-ink-soft)]">
        <Link href={`/${locale}/sign-in`} className="underline underline-offset-2">{t("signInTitle")}</Link>
      </p>
    </main>
  );
}
