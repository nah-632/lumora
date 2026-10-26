import Link from "next/link";
import { LANDING } from "@/content/landing";

/**
 * Feature section.
 *
 * Four rows divided by hairlines, full width, under a two-part header: the claim
 * on the inline-start side, the explanation opposite it. Rows rather than four
 * equal cards, because four equal cards is the shape every generated page
 * reaches for — and because a row can carry a real sentence at reading width
 * while a card in a 4-up grid can only carry a fragment.
 *
 * There is no "more" link on each row. A control must lead where its label says
 * it leads; with no per-feature page yet, a "more" link would have to point at
 * the sign-in screen, which is a small lie in a product that cannot afford one.
 *
 * Icons are authored SVG at a uniform 1.5px stroke on a tinted disc — one tint
 * per feature, all from the palette.
 */
export function Features({ locale }: { locale: "ar" | "en" }) {
  const t = LANDING[locale];

  return (
    <section id="features" className="section" aria-labelledby="features-heading">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
        <div className="flex flex-col gap-5 border-b border-[var(--lumora-line)] pb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2 id="features-heading" className="section-title max-w-[18ch] lg:mt-0">
            {t.featuresTitle}
          </h2>
          <p className="max-w-[46ch] text-[1rem] leading-relaxed text-[var(--lumora-ink-soft)]">
            {t.featuresIntro}
          </p>
        </div>

        <ul>
          {t.features.map((f, i) => (
            <li
              key={f.key}
              data-reveal
              style={{ transitionDelay: `${i * 60}ms` }}
              className="border-b border-[var(--lumora-line)]"
            >
              <div className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5 gap-y-1 py-6 sm:grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)] sm:items-baseline sm:gap-x-8 sm:py-7">
                <span className={`disc disc-${f.key}`} aria-hidden="true">
                  <FeatureIcon name={f.key} />
                </span>
                <h3 className="font-display text-[1.05rem] font-bold leading-snug text-[var(--lumora-navy)] sm:text-lg">
                  {f.title}
                </h3>
                <p className="col-start-2 max-w-[58ch] text-[0.95rem] leading-relaxed text-[var(--lumora-ink-soft)] sm:col-start-3">
                  {f.line}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-[var(--lumora-ink-soft)]">
          <Link
            href={`/${locale}/sign-up`}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--lumora-red)] underline-offset-4 hover:underline"
          >
            {locale === "ar" ? "أنشئ حسابك وابدأ" : "Create your account and start"}
            <svg className="arrow-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </p>
      </div>
    </section>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  const stroke = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "students") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.2" {...stroke} />
        <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" {...stroke} />
        <path d="M16 6.5h4.5M18.25 4.25v4.5" {...stroke} />
      </svg>
    );
  }
  if (name === "alerts") {
    return (
      <svg {...common}>
        <path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5Z" {...stroke} />
        <path d="M10 18.5a2 2 0 0 0 4 0" {...stroke} />
      </svg>
    );
  }
  if (name === "plans") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2.2" {...stroke} />
        <path d="M8 9h8M8 13h8M8 17h4" {...stroke} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 4h9l3 3v13H6z" {...stroke} />
      <path d="M9 11.5h6M9 15h4" {...stroke} />
      <path d="m9 7.5 1.4 1.4L13 6.3" {...stroke} />
    </svg>
  );
}