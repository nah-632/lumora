import { getRequestConfig } from "next-intl/server";

/**
 * Locale configuration. Arabic is the default; both catalogs are maintained
 * independently rather than machine-translated from one another.
 */
export default getRequestConfig(async ({ locale }) => {
  const resolved = locale === "en" ? "en" : "ar";
  return {
    locale: resolved,
    messages: (await import(`./messages/${resolved}.json`)).default,
  };
});
