import { getTranslations } from "next-intl/server";
import "@/styles/scanner.css";
import { ScannerBelt, type ScannerCardCopy } from "./ScannerBelt";

/**
 * "From scattered paper to a ready plan".
 *
 * One static, prerendered section. All copy comes from the `scanner` namespace
 * in messages/{ar,en}.json — including the four cards' raw material and result
 * lines — so nothing is hard-coded here and both languages are edited in one
 * place.
 *
 * The section is illustrative and says so twice: the caption under the scene,
 * and the fictional "Student 1…5" labels inside the cards. It makes no claim
 * about time saved, accuracy or curriculum, because nothing on screen supports
 * such a claim.
 */
export async function ScannerSection({ locale }: { locale: "ar" | "en" }) {
  const t = await getTranslations({ locale, namespace: "scanner" });

  // The catalog is repository-owned, not user input; next-intl hands raw
  // structures back untyped, so the shape is asserted by the type below and
  // checked at build time by the message-parity test.
  const cards = t.raw("cards") as ScannerCardCopy[];

  return (
    <section id="scanner" className="scanner-section" aria-labelledby="scanner-heading">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
        <div className="scanner-header">
          <h2 id="scanner-heading" className="section-title">
            {t("heading")}
          </h2>
          <p className="scanner-sub">{t("subtext")}</p>
        </div>

        <ScannerBelt
          locale={locale}
          cards={cards}
          labels={{
            counterLabel: t("counterLabel"),
            pause: t("pause"),
            play: t("play"),
            prev: t("prev"),
            next: t("next"),
            sceneLabel: t("sceneLabel"),
            srHint: t("srHint"),
          }}
        />

        <p className="scanner-caption">{t("caption")}</p>
      </div>
    </section>
  );
}
