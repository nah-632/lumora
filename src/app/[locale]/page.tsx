import { notFound } from "next/navigation";
import "@/styles/landing.css";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
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
        <Hero locale={locale} />
        <Features locale={locale} />
        <HowItWorks locale={locale} />
        <Showcase locale={locale} />
        <AboutContact locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
