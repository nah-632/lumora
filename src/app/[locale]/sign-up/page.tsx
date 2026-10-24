import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { signUpAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/server";

// Every page here depends on the request (session cookie or locale), so it
// must never be prerendered. Without this Next attempts to render these at
// build time, where cookies() and the auth client are unavailable, and the
// prerender worker stalls.
export const dynamic = "force-dynamic";


export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  if (await getSessionUser()) redirect(`/${locale}/students`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const labels = Object.fromEntries(
    [
      "fullName","email","password","passwordHint","working","signUpTitle",
      "submit_sign-up","checkEmail","err_invalid_input","err_email_taken",
      "err_rate_limited","err_not_configured","err_failed","haveAccount","signInTitle",
    ].map((k) => [k, t(k)]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <LumoraMark locale={locale} href={`/${locale}`} size={40} withWordmark />
      <h1 className="text-2xl font-semibold text-navy">{t("signUpTitle")}</h1>
      <div className="mt-6">
        <AuthForm mode="sign-up" locale={locale} labels={labels} action={signUpAction} />
      </div>
      <p className="mt-6 text-sm text-[var(--lumora-ink-soft)]">
        {t("haveAccount")}{" "}
        <Link href={`/${locale}/sign-in`} className="font-medium text-red underline underline-offset-2">
          {t("signInTitle")}
        </Link>
      </p>

      {/*
        Consent is stated where consent is given, not buried in a footer the
        visitor may never scroll to. The terms and the policy are links because
        the visitor must be able to read what they are agreeing to.
      */}
      <p className="mt-6 text-xs leading-relaxed text-[var(--lumora-ink-soft)]">
        {locale === "ar" ? (
          <>
            بإنشائك حسابًا فإنك توافق على{" "}
            <Link href={`/${locale}/terms`} className="font-medium text-navy underline underline-offset-2">شروط الاستخدام</Link>
            {" "}و{" "}
            <Link href={`/${locale}/privacy`} className="font-medium text-navy underline underline-offset-2">سياسة الخصوصية</Link>
            .
          </>
        ) : (
          <>
            By creating an account you agree to the{" "}
            <Link href={`/${locale}/terms`} className="font-medium text-navy underline underline-offset-2">terms of use</Link>
            {" "}and the{" "}
            <Link href={`/${locale}/privacy`} className="font-medium text-navy underline underline-offset-2">privacy policy</Link>
            .
          </>
        )}
      </p>
    </main>
  );
}
