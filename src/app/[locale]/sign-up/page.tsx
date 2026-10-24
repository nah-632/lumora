import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { signUpAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/server";

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
    </main>
  );
}
