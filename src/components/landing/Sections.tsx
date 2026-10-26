import Image from "next/image";
import Link from "next/link";
import { LANDING } from "@/content/landing";

/**
 * How it works, the workspace showcase, About preview and contact.
 *
 * The two supplied images are used as what they are — an illustration and a
 * photograph of a workspace with a mock dashboard — and each says so where a
 * reader could otherwise mistake it for a product screenshot. No caption, badge
 * or watermark is drawn on the image itself.
 */
export function HowItWorks({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <section id="how" className="section section-tinted" aria-labelledby="how-heading">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal className="reveal lg:order-2">
            <h2 id="how-heading" className="section-title">
              {locale === "ar" ? "ثلاث خطوات، ثم تعمل." : "Three steps, then it works."}
            </h2>

            <ol className="mt-8 space-y-7">
              {t.howSteps.map((s, i) => (
                <li key={s.title} className="flex gap-5">
                  <span className="step-index" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--lumora-navy)]">{s.title}</h3>
                    <p className="mt-1 max-w-[62ch] text-[0.95rem] leading-relaxed text-[var(--lumora-ink-soft)]">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/*
            The supplied isometric illustration already places its objects to the
            inline-end of a wide frame, so in RTL it is mirrored to sit on the same
            side as the reading order rather than floating against it.
          */}
          <div data-reveal="frame" className="reveal lg:order-1">
            <div className="illustration-frame">
              <Image
                src="/brand/features-3d.webp"
                alt={
                  locale === "ar"
                    ? "رسم توضيحي: هاتف تعرض عليه فقاعات محادثة، وبطاقة مستند تحمل شعار لومورا، ونافذة تقويم."
                    : "Illustration: a phone showing chat bubbles, a document card bearing the Lumora mark, and a calendar window."
                }
                width={1200}
                height={670}
                sizes="(max-width: 1024px) 92vw, 46vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Showcase({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <section className="section" aria-labelledby="showcase-heading">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
        <div data-reveal className="reveal grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-center lg:gap-16">
          <div className="lg:order-2">
            <h2 id="showcase-heading" className="section-title">
              {t.showcaseTitle}
            </h2>
            <p className="mt-5 max-w-[60ch] text-[0.98rem] leading-relaxed text-[var(--lumora-ink-soft)]">
              {t.showcaseBody}
            </p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--lumora-ink-soft)]">
              <span className="h-px w-8 bg-[var(--lumora-gold)]" aria-hidden="true" />
              {locale === "ar" ? "رسم توضيحي" : "Illustration"}
            </p>
          </div>
          <div className="lg:order-1" data-reveal="frame">
            <div className="showcase-frame">
              <Image
                src="/brand/lesson-plans-desk.webp"
                alt={
                  locale === "ar"
                    ? "طاولة خشبية عليها جهاز لوحي يعرض لوحة تحكم توضيحية، مع دلة قهوة وتمور ودفتر ملاحظات."
                    : "A wooden desk with a tablet showing an illustrative dashboard, beside a Bahraini coffee pot, dates and a notebook."
                }
                width={1600}
                height={893}
                sizes="(max-width: 1024px) 92vw, 58vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutContact({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <section className="section section-navy" aria-labelledby="about-heading">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <div data-reveal className="reveal">
          <h2 id="about-heading" className="section-title title-invert">
            {locale === "ar" ? "مبادرة مستقلة، للمعلم أولًا." : "An independent initiative, for the teacher first."}
          </h2>
          <p className="mt-5 max-w-[64ch] text-[0.98rem] leading-relaxed text-white/75">{t.aboutBody}</p>
          <Link href={`/${locale}/about`} className="btn-outline-light mt-8">
            {t.aboutCta}
          </Link>
        </div>

        <div data-reveal id="contact" className="reveal">
          <h2 className="section-title title-invert text-[clamp(1.5rem,1.1rem+1.2vw,2.1rem)]">
            {locale === "ar" ? "اكتب لنا." : "Write to us."}
          </h2>
          <p className="mt-4 max-w-[62ch] text-[0.95rem] leading-relaxed text-white/70">{t.contactBody}</p>
          <ul className="mt-8 space-y-3 text-[0.95rem] text-white/85">
            <li>
              <Link href={`/${locale}/about`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                {locale === "ar" ? "عن لومورا" : "About Lumora"}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/privacy`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                {locale === "ar" ? "سياسة الخصوصية" : "Privacy policy"}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/terms`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                {locale === "ar" ? "شروط الاستخدام" : "Terms of use"}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}