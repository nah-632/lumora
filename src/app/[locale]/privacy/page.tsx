import type { Metadata } from "next";
import Link from "next/link";
import { LumoraMark } from "@/components/brand/LumoraMark";
import { PRIVACY, LEGAL_REVIEW } from "@/content/legal";

/**
 * Privacy policy — static: no session, no cookies, no data reads.
 */
export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // These three are public on purpose, unlike the app itself.
  return { robots: { index: true, follow: true }, title: `${PRIVACY[locale].title} · Lumora` };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const copy = PRIVACY[locale];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
      <header className="flex items-center gap-3">
        <LumoraMark locale={locale} href={`/${locale}`} size={32} />
        <Link href={`/${locale}`} className="text-sm font-medium text-navy underline-offset-4 hover:underline">
          {locale === "ar" ? "لومورا" : "Lumora"}
        </Link>
      </header>

      <h1 className="mt-8 text-3xl font-semibold text-navy">{copy.title}</h1>

      {/* The review is complete (ADR-011), so the page states its version and the
          date it took effect — the two facts a policy needs to be citable — and
          makes no claim that it is still under review. */}
      <p className="mt-3 text-xs text-[var(--lumora-ink-soft)] tnum">
        {locale === "ar"
          ? `الإصدار ${LEGAL_REVIEW.version} · سارية من ${LEGAL_REVIEW.effectiveDate}`
          : `Version ${LEGAL_REVIEW.version} · Effective ${LEGAL_REVIEW.effectiveDate}`}
      </p>

      <ol className="mt-8 space-y-8">
        {copy.sections.map((section, i) => (
          <li key={section.heading}>
            <h2 className="text-base font-semibold text-navy">
              <span className="tnum me-2 text-[var(--lumora-ink-soft)]">{i + 1}.</span>
              {section.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lumora-ink)]">{section.body}</p>
          </li>
        ))}
      </ol>

      <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--lumora-line)] pt-6 text-sm">
        <Link href={`/${locale}/about`} className="text-navy underline underline-offset-4">
          {locale === "ar" ? "عن لومورا" : "About Lumora"}
        </Link>
        <Link href={`/${locale}/terms`} className="text-navy underline underline-offset-4">
          {locale === "ar" ? "شروط الاستخدام" : "Terms of use"}
        </Link>
      </nav>
    </main>
  );
}