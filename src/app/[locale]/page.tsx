import { notFound } from "next/navigation";
import "@/styles/landing.css";
// After landing.css on purpose: the reference composition overrides the header's
// surface and owns the whole first screen, so it has to win the cascade.
import "@/styles/landing-reference.css";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { HowItWorks, Showcase, AboutContact } from "@/components/landing/Sections";
import { SiteFooter } from "@/components/SiteFooter";
import { MotionRoot } from "@/components/landing/MotionRoot";

/**
 * The public entry page.
 *
 * Static on purpose: it reads no session and no cookie, so it is prerendered at
 * build time and served from the edge cache. Everything on it is content, not
 * data — the signed-in workspace lives at /[locale]/students.
 *
 * generateStaticParams is inherited from the parent segment, which already
 * enumerates ar and en; an unknown locale is a 404 rather than a silent fallback.
 *
 * The first screen is one composition: header, hero, the four tool cards and the
 * benefit strip, sized to the frame in the owner's reference. Below it the older
 * sections continue unchanged.
 */
const LOCALES = ["ar", "en"] as const;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function LandingPage({ params }: { params: { locale: string } }) {
  if (!(LOCALES as readonly string[]).includes(params.locale)) notFound();
  const locale = params.locale as "ar" | "en";

  return (
    <>
      {/*
        No pre-paint script: the reveal's hidden state is applied by MotionRoot
        only after it has proven it can reveal again. Previously an inline script
        added `.js-reveal` before paint to hide every section up front, which
        turned any failure of the client effect into a blank page — the hidden
        state existed even when the code that was supposed to undo it did not.
      */}
      <MotionRoot />
      <SiteHeader locale={locale} />
      <main>
        <LandingHero locale={locale} />
        <HowItWorks locale={locale} />
        <Showcase locale={locale} />
        <AboutContact locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
