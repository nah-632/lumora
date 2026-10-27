import Image from "next/image";
import Link from "next/link";
import { LANDING } from "@/content/landing";

/**
 * Hero.
 *
 * The supplied artwork is a lit bulb on the right with a white field on the left.
 * Arabic puts the headline on the right, which is the bulb — so the image is
 * mirrored with `scaleX(-1)` in RTL only, putting the white field on the right
 * under the text, and the bulb on the left. The original file is untouched; a
 * mirrored render of a photograph that has no text or directional object in it
 * cannot introduce a wrong-reading detail, and the palm fronds are symmetric
 * enough that the mirror is not noticeable as a mirror.
 *
 * The headline is live HTML, never baked into the image: it must reflow, be
 * selectable, translate, and carry its own contrast.
 */
export function Hero({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <section className="hero" aria-labelledby="hero-heading">
      {/*
        One image, two crops: `object-position` keeps the bulb visible on a phone
        where the aspect ratio is portrait, and priority is set because this is
        the LCP element.
      */}
      <div className="hero-media" aria-hidden="true">
        <Image
          src="/brand/hero-bulb.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-wash" />
      </div>

      <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:pb-32 lg:pt-24">
        <div className="max-w-[34rem] lg:max-w-[36rem]">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-rule" aria-hidden="true" />
            {t.eyebrow}
          </p>

          {/*
            The accent word carries the second half of the line in Bahraini Red.
            When a locale has no accent (the slogan is a complete phrase in both
            languages), the whole second line is set in the accent colour rather
            than emitting an empty span and a stray space.
          */}
          <h1 id="hero-heading" className="hero-headline">
            <span className="hero-line">{t.headline.lead}</span>
            <span className="hero-line">
              {t.headline.accent ? `${t.headline.accent} ` : null}
              <em className="hero-accent">{t.headline.rest}</em>
            </span>
          </h1>

          <p className="hero-lead">{t.lead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={`/${locale}/sign-up`} className="btn-primary">
              {t.primaryCta}
              <Arrow />
            </Link>
            <Link href="#how" className="btn-ghost">
              {t.secondaryCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <svg className="arrow-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}