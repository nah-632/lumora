import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * The public site header, drawn for the reference landing composition.
 *
 * It sits transparent over the artwork — the artwork's own light field is the
 * header's background — and only takes a surface once the page has scrolled
 * (MotionRoot flips `data-scrolled`) so navigation stays legible over the darker
 * parts of the image further down.
 *
 * Navigation lists destinations that exist on this page and nothing else. Both
 * entries are plain anchors with no chevron: a chevron is a promise of a
 * dropdown, and there is no dropdown here. Anything else the reference showed —
 * pricing, product, use cases — has no page behind it yet, and a nav item that
 * leads nowhere is worse than a shorter nav.
 *
 * The logo sits at the inline start through normal document flow, so it mirrors
 * to the correct side without a rule. The actions are ordered reading-direction
 * first: the language switch, then sign-in, then the primary call to action.
 */
export async function SiteHeader({ locale }: { locale: "ar" | "en" }) {
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <header
      data-site-header="true"
      data-scrolled="false"
      className="site-header lp-header"
    >
      <div className="lp-header__bar lp-rise lp-rise--1">
        <Link
          href={`/${locale}`}
          className="lp-header__logo"
          aria-label={t("a11y.logo")}
        >
          {/*
            The horizontal lockup, cropped from the supplied square artwork and
            set at a fixed size so the header reserves its space and nothing
            shifts when the image resolves.
          */}
          <Image
            src="/brand/lumora-lockup-h.png"
            alt=""
            width={194}
            height={58}
            priority
            sizes="194px"
            className="lp-header__lockup"
          />
        </Link>

        <nav aria-label={t("a11y.primaryNav")} className="lp-header__nav">
          <ul>
            <li>
              <Link href="#tools-row" className="lp-nav-link">
                {t("nav.tools")}
              </Link>
            </li>
            <li>
              <Link href="#benefits" className="lp-nav-link">
                {t("nav.benefits")}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="lp-header__actions">
          <Link
            href={locale === "ar" ? "/en" : "/ar"}
            className="lp-header__lang"
            hrefLang={locale === "ar" ? "en" : "ar"}
            lang={locale === "ar" ? "en" : "ar"}
          >
            {locale === "ar" ? "EN" : "ع"}
          </Link>

          <Link href={`/${locale}/sign-in`} className="lp-signin">
            <UserIcon />
            {t("signIn")}
          </Link>

          <Link href={`/${locale}/sign-in`} className="lp-btn lp-btn--gold lp-header__cta">
            {t("getStarted")}
            <ArrowRight />
          </Link>
        </div>
      </div>
    </header>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 19.5c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6" />
    </svg>
  );
}

/** Mirrored in RTL by CSS: the same glyph means "onward" in both directions. */
function ArrowRight() {
  return (
    <svg className="lp-arrow lp-arrow--right" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
