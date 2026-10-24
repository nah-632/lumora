import type { Metadata } from "next";
import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { ABOUT } from "@/content/about";

/**
 * About — static by design: no session, no cookies, no data reads.
 *
 * `force-static` makes that a build-time property rather than an accident: if
 * anyone later adds a request-dependent call to this page, the build says so
 * instead of silently turning the page dynamic.
 */
export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // These three are public on purpose, unlike the app itself.
  return { robots: { index: true, follow: true }, title: `${ABOUT[locale].title} · Lumora` };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const copy = ABOUT[locale];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
      <header className="flex items-center gap-3">
        <LumoraMark locale={locale} href={`/${locale}`} size={36} />
        <Link href={`/${locale}`} className="text-sm font-medium text-navy underline-offset-4 hover:underline">
          {locale === "ar" ? "لومورا" : "Lumora"}
        </Link>
      </header>

      <h1 className="mt-8 text-3xl font-semibold leading-tight text-navy sm:text-4xl">{copy.title}</h1>
      {/* The slogan is the one line on this page that is a quotation, not a
          heading — it keeps its own rhythm in both languages. */}
      <p dir={locale === "ar" ? "rtl" : "ltr"} className="mt-2 text-lg font-medium text-red">
        {copy.slogan}
      </p>
      <p className="mt-5 text-base leading-relaxed text-[var(--lumora-ink)]">{copy.lead}</p>

      <img
        src="/brand/hero-bulb.webp"
        alt=""
        width={1600}
        height={893}
        className="mt-8 w-full rounded-lg border border-[var(--lumora-line)] object-cover"
        decoding="async"
      />

      {copy.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-lg font-semibold text-navy">{section.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--lumora-ink)]">{section.body}</p>
        </section>
      ))}

      <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--lumora-line)] pt-6 text-sm">
        <Link href={`/${locale}/privacy`} className="text-navy underline underline-offset-4">
          {locale === "ar" ? "سياسة الخصوصية" : "Privacy policy"}
        </Link>
        <Link href={`/${locale}/terms`} className="text-navy underline underline-offset-4">
          {locale === "ar" ? "شروط الاستخدام" : "Terms of use"}
        </Link>
        <Link href={`/${locale}/sign-up`} className="text-navy underline underline-offset-4">
          {locale === "ar" ? "إنشاء حساب" : "Create an account"}
        </Link>
      </nav>
    </main>
  );
}