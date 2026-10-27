import localFont from "next/font/local";

/**
 * Typefaces, self-hosted. No request leaves the build or the browser for
 * fonts.googleapis.com.
 *
 * Until now these came from `next/font/google`, which fetches the CSS and the
 * woff2 files at BUILD time. That made the production build depend on Google
 * being reachable from CI: one transient fetch failure failed the whole build
 * job with `An error occurred in next/font … Cannot read properties of null`,
 * which is what a self-hosted font cannot do.
 *
 * ---------------------------------------------------------------------------
 * WHY FOUR INSTANCES AND NOT TWO
 *
 * The Arabic and Latin subsets are separate files (that is how Google ships
 * them), and a subset file does not contain the other script's glyphs. Pointing
 * one family at both and hoping the browser sorts it out is exactly the bug that
 * made headings unreadable earlier in this project: a Latin face claimed Arabic
 * codepoints and rendered them with colliding, unjoined letters.
 *
 * So each subset is its own family, and the CSS simply lists them in order:
 * the Arabic family first for Arabic, which falls through to the Latin family
 * only for characters it does not contain. Per-glyph fallback does the work that
 * `unicode-range` did in the hand-written @font-face blocks, without hand-writing
 * them.
 *
 * Weights in use stay three: 400 body, 500 label/button, 600-700 display.
 * `display: "swap"` on every face, so text paints immediately in the fallback and
 * reflows once — never invisible text.
 */

const displayAr = localFont({
  src: [
    { path: "../../public/fonts/elmessiri-500-arabic.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/elmessiri-600-arabic.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/elmessiri-700-arabic.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display-ar",
  fallback: ["Noto Naskh Arabic", "serif"],
});

const displayLat = localFont({
  src: [
    { path: "../../public/fonts/elmessiri-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/elmessiri-600-latin.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/elmessiri-700-latin.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display-lat",
  fallback: ["Georgia", "serif"],
});

const textAr = localFont({
  src: [
    { path: "../../public/fonts/plexarabic-400-arabic.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/plexarabic-500-arabic.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/plexarabic-600-arabic.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-text-ar",
  fallback: ["Noto Naskh Arabic", "sans-serif"],
});

const textLat = localFont({
  src: [
    { path: "../../public/fonts/plexlatin-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/plexlatin-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/plexlatin-600-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-text-lat",
  fallback: ["Segoe UI", "sans-serif"],
});

/**
 * The shape the layout already consumes. Two class names per export, so the root
 * element carries four font variables and `globals.css` composes the stacks.
 */
export const display = { variable: `${displayAr.variable} ${displayLat.variable}` };
export const text = { variable: `${textAr.variable} ${textLat.variable}` };