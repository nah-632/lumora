import Link from "next/link";

/**
 * Footer for the signed-in surfaces, carrying the public pages.
 *
 * Kept as plain links — the public pages are static, so following one costs the
 * browser nothing but the document. The logo is the mark only: the wordmark sits
 * in the header where a full lockup belongs.
 */
export function SiteFooter({ locale }: { locale: "ar" | "en" }) {
  return (
    <footer className="mt-14 border-t border-[var(--lumora-line)] bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-[var(--lumora-ink-soft)] sm:px-6 lg:px-8">
        <span>
          {locale === "ar"
            ? "لومورا — مساعدك الذكي لإلهام الغد"
            : "Lumora — your smart assistant for tomorrow's inspiration"}
        </span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/${locale}/about`} className="underline-offset-4 hover:underline">
            {locale === "ar" ? "عن لومورا" : "About"}
          </Link>
          <Link href={`/${locale}/privacy`} className="underline-offset-4 hover:underline">
            {locale === "ar" ? "الخصوصية" : "Privacy"}
          </Link>
          <Link href={`/${locale}/terms`} className="underline-offset-4 hover:underline">
            {locale === "ar" ? "الشروط" : "Terms"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}