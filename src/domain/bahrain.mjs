export const BAHRAIN_GOVERNORATES = [
  { id: "capital", ar: "العاصمة", en: "Capital" },
  { id: "muharraq", ar: "المحرق", en: "Muharraq" },
  { id: "northern", ar: "الشمالية", en: "Northern" },
  { id: "southern", ar: "الجنوبية", en: "Southern" },
];
export const BAHRAIN_TIMEZONE = "Asia/Bahrain";
export const WEEKEND_DAYS = [5, 6];

export function normalizeBahrainPhone(raw) {
  const digits = String(raw).replace(/[\s\-()]/g, "");
  if (/^\+973\d{8}$/.test(digits)) return digits;
  if (/^973\d{8}$/.test(digits)) return "+" + digits;
  if (/^\d{8}$/.test(digits)) return "+973" + digits;
  return null;
}
