import { El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * The two typefaces, declared once and imported by the layout that renders
 * <html>. They live outside the layout file because Next.js generates route
 * types from every export of a layout module and rejects anything that is not a
 * recognised layout export — a font object must not be one of them.
 *
 * Typography is locked by a specimen test (El Messiri, Noto Kufi Arabic,
 * Markazi Text and Cairo against IBM Plex Sans Arabic, rendered on the real
 * headline at 64px and measured in the browser). Both families ship via
 * next/font, so there is no third-party request at runtime and the generated
 * size-adjust keeps the swap from shifting layout.
 *
 * Display: El Messiri at 500/600/700. Holds the headline at 64-80px without the
 * rounded softness that makes most Arabic display faces read as children's
 * material; its calligraphic terminals give the slogan a hand-cut character,
 * and it sets 397px wide where Noto Kufi Arabic takes 438px — an extra word per
 * line at hero size. It also covers Latin, so no second display face ships.
 *
 * Text: IBM Plex Sans Arabic. Drawn for Arabic alongside a Latin family with the
 * same skeleton, so «التعليم» beside "LUMORA" keeps one stroke weight. It carries
 * the UI where El Messiri's open counters would read thin below 20px.
 *
 * Three weights in use overall: 400 body, 500 label and button, 600-700 display.
 */
export const display = El_Messiri({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

export const text = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-arabic",
});