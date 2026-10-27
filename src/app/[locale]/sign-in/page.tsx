import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { signInAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

// Every page here depends on the request (session cookie or locale), so it
// must never be prerendered. Without this Next attempts to render these at
// build time, where cookies() and the auth client are unavailable, and the
// prerender worker stalls.
export const dynamic = "force-dynamic";


export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;

  // Already signed in: no reason to show this page.
  if (await getSessionUser()) redirect(`/${locale}/students`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const labels = Object.fromEntries(
    [
      "fullName","email","password","passwordHint","working","signInTitle",
      "submit_sign-in","submit_sign-up","submit_reset","resetSent","checkEmail",
      "err_invalid_input","err_invalid_credentials","err_email_not_confirmed",
      "err_email_taken","err_rate_limited","err_not_configured","err_failed",
      "noAccount","haveAccount","forgotPassword",
    ].map((k) => [k, t(k)]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <LumoraMark locale={locale} href={`/${locale}`} size={40} withWordmark />
      <h1 className="text-2xl font-semibold text-navy">{t("signInTitle")}</h1>
      <div className="mt-6">
        <AuthForm mode="sign-in" locale={locale} labels={labels} action={signInAction} next={next} />
      </div>
      <div className="mt-6 space-y-2 text-sm text-[var(--lumora-ink-soft)]">
        <p>
          {t("noAccount")}{" "}
          <Link href={`/${locale}/sign-up`} className="font-medium text-red underline underline-offset-2">
            {t("signUpTitle")}
          </Link>
        </p>
        <p>
          <Link href={`/${locale}/reset-password`} className="underline underline-offset-2">
            {t("forgotPassword")}
          </Link>
        </p>
      </div>
    </main>
  );
}
