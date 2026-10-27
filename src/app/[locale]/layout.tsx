import { notFound } from "next/navigation";
import { display, text } from "@/design/fonts";

/**
 * The document shell, scoped to the locale.
 *
 * `lang` and `dir` are decided here because this is the first layout that knows
 * which language the page is written in. Getting this wrong is not cosmetic: with
 * a hard-coded Arabic shell, /en served English copy inside an RTL document, so
 * `margin-inline-start`, `text-align: start`, the mirrored arrows and the
 * `inline-start` nav underline all resolved to the wrong edge, and assistive
 * technology announced English text as Arabic.
 *
 * `generateStaticParams` enumerates both locales, so each language is still
 * prerendered as a static page rather than made dynamic to read the params.
 */
const LOCALES = ["ar", "en"] as const;
type Locale = (typeof LOCALES)[number];

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!(LOCALES as readonly string[]).includes(params.locale)) notFound();
  const locale = params.locale as Locale;

  // The only directional fact stored per locale. Everything downstream uses
  // logical CSS properties, so this is the single switch the whole layout reads.
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${display.variable} ${text.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}