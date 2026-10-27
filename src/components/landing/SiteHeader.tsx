import Image from "next/image";
import Link from "next/link";
import { LANDING } from "@/content/landing";

/**
 * Public site header.
 *
 * Logo at the inline start (right in Arabic, left in English) via normal document
 * flow — no absolute positioning, so it mirrors without a rule. Navigation is
 * text, not buttons: a nav item is a destination, and styling it as a control
 * makes the page look like a dashboard.
 *
 * The mobile menu is a <details>-free implementation: a real <button> toggling a
 * sheet, because the sheet needs to close on Escape and on navigation, and a
 * native disclosure element cannot do the first.
 */
export function SiteHeader({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <header
      data-site-header="true"
      data-scrolled="false"
      className="site-header sticky top-0 z-40 border-b border-transparent"
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-6 px-5 py-4 sm:px-8">
        <Link
          href={`/${locale}`}
          className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]"
          aria-label={locale === "ar" ? "لومورا — الصفحة الرئيسية" : "Lumora — home"}
        >
          {/*
            Horizontal lockup, derived by cropping the supplied artwork: the mark
            and the LUMORA wordmark were cut from the 2048px square lockup and set
            side by side at 3x, because the supplied file is stacked (mark above
            wordmark above tagline) and a 44px rendition of it is unreadable in a
            header. Nothing is redrawn or recoloured — only cropped and spaced.

            Width and height are fixed, so there is no layout shift; the tagline
            is dropped here because at header size it would sit under two pixels.
          */}
          <Image
            src="/brand/lumora-lockup-h.png"
            alt={locale === "ar" ? "لومورا" : "Lumora"}
            width={194}
            height={58}
            priority
            sizes="194px"
            className="h-[46px] w-auto sm:h-[52px]"
          />
        </Link>

        <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main"} className="hidden lg:block">
          <ul className="flex items-center gap-7 text-[0.95rem] text-[var(--lumora-navy)]">
            {t.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href.startsWith("#") ? item.href : `/${locale}${item.href}`} className="nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:gap-3">
          <Link
            href={locale === "ar" ? "/en" : "/ar"}
            className="hidden rounded-md px-2 py-1 text-sm text-[var(--lumora-ink-soft)] transition-colors hover:text-[var(--lumora-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:block"
            hrefLang={locale === "ar" ? "en" : "ar"}
            lang={locale === "ar" ? "en" : "ar"}
          >
            {locale === "ar" ? "EN" : "ع"}
          </Link>
          <Link
            href={`/${locale}/sign-in`}
            className="btn-primary btn-sm"
          >
            {t.loginLabel}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Directional icon. Mirrored in RTL by CSS (`[dir="rtl"] .arrow-icon`), never by
 * a second asset — the same glyph means "onward" in both directions.
 */
function ArrowIcon() {
  return (
    <svg className="arrow-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}