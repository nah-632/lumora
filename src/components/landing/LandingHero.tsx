import { getImageProps } from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * The landing page's first screen: header band, hero, the card row and the
 * benefit strip, exactly as the owner's reference composes them.
 *
 * Everything here is a server component. The entrance is a CSS keyframe with a
 * per-element animation-delay, so the stagger needs no JavaScript and a render
 * that never runs the animation is still a complete, readable page.
 *
 * DIRECTION. The composition is physically fixed: the text column is on the
 * physical left, the artwork and the card row are on the physical right, and the
 * artwork is never mirrored. That is a property of the ARTWORK, not of the
 * language — the fog the text sits on is on the left, and mirroring it to follow
 * a reading direction would put the text on the busy part of the image. What
 * does follow the language is everything inside the two regions: the text
 * column's alignment, the order of the buttons, and the order of the cards and
 * strip items, which come from the document direction.
 *
 * The artwork carries the whole first screen, including behind the header — the
 * header is transparent over it, as in the reference.
 */

const CARD_ORDER = [
  {
    key: "lessonPlan",
    href: "/tools",
    icon: "plan",
    cta: "tryTool",
    featured: false,
  },
  {
    key: "questions",
    href: "/tools",
    icon: "questions",
    cta: "tryTool",
    featured: true,
  },
  {
    key: "remedial",
    href: "/tools",
    icon: "remedial",
    cta: "tryTool",
    featured: false,
  },
  {
    key: "students",
    href: "/students",
    icon: "students",
    cta: "open",
    featured: false,
  },
] as const;

const STRIP_ORDER = ["bilingual", "tap", "review", "stage"] as const;

export async function LandingHero({ locale }: { locale: "ar" | "en" }) {
  const t = await getTranslations({ locale, namespace: "landing" });

  /*
   * Three crops of one artwork, chosen by `<picture>` rather than by CSS.
   *
   * The phone crop is centred on the skyline; the desktop frame shows the whole
   * composition. Switching the source in CSS would still download the wrong
   * file, and switching the element would download both, so the media query has
   * to be made where the browser can act on it before it fetches.
   */
  const shared = {
    alt: "",
    sizes: "100vw",
    priority: true,
    fetchPriority: "high" as const,
  };
  const desktop = getImageProps({
    ...shared,
    src: "/images/landing-hero-desktop.webp",
    width: 1672,
    height: 941,
  }).props;
  const tablet = getImageProps({
    ...shared,
    src: "/images/landing-hero-tablet.webp",
    width: 1200,
    height: 675,
  }).props;
  const mobile = getImageProps({
    ...shared,
    src: "/images/landing-hero-mobile.webp",
    width: 900,
    height: 562,
  }).props;

  return (
    <section className="lp-screen" id="hero" aria-labelledby="hero-heading">
      <div className="lp-screen__art" aria-hidden="true">
        <picture>
          <source media="(max-width: 767px)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
          <source media="(max-width: 1279px)" srcSet={tablet.srcSet} sizes={tablet.sizes} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...desktop}
            alt=""
            className="lp-screen__img"
            style={{ objectFit: "cover" }}
          />
        </picture>
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="lp-copy">
        <p className="lp-badge lp-rise lp-rise--2">
          <GraduationCap />
          {t("badge")}
        </p>

        <h1 id="hero-heading" className="lp-headline lp-rise lp-rise--3">
          <span>{t("headline.line1")}</span>
          <span>{t("headline.line2")}</span>
        </h1>

        <p className="lp-subtext lp-rise lp-rise--4">{t("subtext")}</p>

        {/*
          Two plain statements, not controls: no link, no button role, nothing
          that promises an interaction the page does not have.
        */}
        <ul className="lp-chips lp-rise lp-rise--5">
          <li className="lp-chip">
            <span className="lp-chip__icon" aria-hidden="true">
              <NoChat />
            </span>
            <span className="lp-chip__label">{t("chips.noChat")}</span>
          </li>
          <li className="lp-chip">
            <span className="lp-chip__icon" aria-hidden="true">
              <ShieldLock />
            </span>
            <span className="lp-chip__label">{t("chips.studentName")}</span>
          </li>
        </ul>

        {/* Primary first in the DOM, so it leads in both reading directions. */}
        <div className="lp-actions lp-rise lp-rise--6">
          <Link href={`/${locale}/sign-in`} className="lp-btn lp-btn--gold">
            {t("getStarted")}
            <ArrowRight />
          </Link>
          <Link href="#tools-row" className="lp-btn lp-btn--outline">
            <ArrowDown />
            {t("discover")}
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*
        The whole card is one link. Nothing is nested inside it that is also
        interactive, so there is no second tab stop per card and no ambiguity
        about which of two overlapping targets a tap meant.
      */}
      <div className="lp-cards" id="tools-row" aria-label={t("a11y.toolsRow")}>
        <ul className="lp-cards__row">
          {CARD_ORDER.map((card, i) => (
            <li key={card.key}>
              <Link
                href={`/${locale}${card.href}`}
                className={
                  card.featured
                    ? "lp-card lp-card--featured lp-rise lp-rise--7"
                    : "lp-card lp-rise lp-rise--7"
                }
                style={{ animationDelay: `${600 + i * 80}ms` }}
              >
                <span className="lp-card__icon" aria-hidden="true">
                  <CardIcon name={card.icon} />
                </span>
                <h2 className="lp-card__title">{t(`cards.${card.key}.title`)}</h2>
                <p className="lp-card__body">{t(`cards.${card.key}.body`)}</p>
                <span className="lp-card__cta">
                  {t(`cta.${card.cta}`)}
                  <ArrowRight />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="lp-strip" id="benefits" aria-label={t("a11y.benefits")}>
        <ul className="lp-strip__items">
          {STRIP_ORDER.map((key) => (
            <li className="lp-strip__item" key={key}>
              <span className="lp-strip__icon" aria-hidden="true">
                <StripIcon name={key} />
              </span>
              <span>
                <span className="lp-strip__title">{t(`strip.${key}.title`)}</span>
                <span className="lp-strip__body">{t(`strip.${key}.body`)}</span>
              </span>
            </li>
          ))}
        </ul>

        {/*
          PHYSICAL bottom-right, in both languages. This block is what covers the
          blurry artefact in the artwork's bottom-right corner; it is part of the
          layout, not an edit to the image. No inverse lockup exists in the
          repository, so the official dark lockup sits on a small off-white
          plate — the fallback the brief allows. The logo is never recoloured.
        */}
        <div className="lp-plate">
          <Link href={`/${locale}`} className="lp-plate__inner" aria-label={t("a11y.logo")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/lumora-lockup-h.png"
              alt=""
              className="lp-plate__logo"
              width={194}
              height={58}
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons — authored inline, never an emoji and never a costume for one         */
/* -------------------------------------------------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function GraduationCap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
    </svg>
  );
}

function NoChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8L4 22v-4.4A7.5 7.5 0 0 1 4.5 7" />
      <path d="M20 12a7.5 7.5 0 0 0-7.5-7.5H11" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function ShieldLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 3.2 5 6v5.4c0 4 2.9 7.4 7 8.4 4.1-1 7-4.4 7-8.4V6l-7-2.8Z" />
      <path d="M9.6 12.2v-1.4a2.4 2.4 0 0 1 4.8 0v1.4" />
      <rect x="8.8" y="12.2" width="6.4" height="4.6" rx="1.2" />
    </svg>
  );
}

function CardIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    ...stroke,
  };
  if (name === "plan") {
    return (
      <svg {...common}>
        <rect x="4.5" y="3.5" width="15" height="17" rx="2.2" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </svg>
    );
  }
  if (name === "questions") {
    return (
      <svg {...common}>
        <path d="M7 4.5h8.5L19 8v11.5H7z" />
        <path d="M9.5 12.5h5M9.5 16h3.5" />
        <path d="m9.5 8.5 1.3 1.3L13.6 7" />
      </svg>
    );
  }
  if (name === "remedial") {
    return (
      <svg {...common}>
        <path d="M4 19V5M4 19h16" />
        <path d="M7.5 15.5 11 12l2.5 2.5L20 8" />
        <path d="M20 11.5V8h-3.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <circle cx="9.5" cy="10.5" r="2.2" />
      <path d="M5.8 16.6c.6-1.9 2.1-3 3.7-3s3.1 1.1 3.7 3" />
      <path d="M16 10h3M16 13.5h3" />
    </svg>
  );
}

function StripIcon({ name }: { name: string }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    ...stroke,
  };
  if (name === "bilingual") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
      </svg>
    );
  }
  if (name === "tap") {
    return (
      <svg {...common}>
        <path d="M9.5 11V5.8a1.8 1.8 0 0 1 3.6 0V11" />
        <path d="M13.1 11V9.4a1.6 1.6 0 0 1 3.2 0V11" />
        <path d="M16.3 11.4a1.6 1.6 0 0 1 3.2 0v3.1a6.6 6.6 0 0 1-6.6 6.6h-1a5.4 5.4 0 0 1-4.1-1.9l-3.4-4a1.6 1.6 0 0 1 2.4-2l1.7 1.8" />
      </svg>
    );
  }
  if (name === "review") {
    return (
      <svg {...common}>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="lp-arrow lp-arrow--right" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg className="lp-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
      <path d="M8 3v9M4.5 8.5 8 12l3.5-3.5" />
    </svg>
  );
}
