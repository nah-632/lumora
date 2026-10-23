export const FILS_PER_BHD = 1000;
export const VAT_RATE_BPS = 0;

export function computeVatFils(netFils, vatRateBps = 0) {
  return Math.round((netFils * vatRateBps) / 10000);
}

export function formatBhd(fils, locale = "en") {
  const bhd = (fils / FILS_PER_BHD).toFixed(3);
  return locale === "ar" ? `${bhd} د.ب` : `BHD ${bhd}`;
}
