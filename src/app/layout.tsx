import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

/**
 * The document shell lives in src/app/[locale]/layout.tsx, not here.
 *
 * `lang` and `dir` are properties of the language a page is written in, so they
 * cannot be set once for the whole site: an English page inside an Arabic
 * document inherits Arabic text direction and every logical CSS property,
 * every mirrored arrow and every "start"-aligned block resolves the wrong way.
 * A root layout sits above the locale segment and cannot read its params, so
 * keeping <html> here would force one direction on both languages — which is
 * exactly the bug this file used to have. This layout is therefore a pass-through
 * and [locale]/layout.tsx owns <html> and <body>.
 *
 * Routes outside [locale] are API handlers only; they return JSON and never
 * render a document, so they need no shell.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

/**
 * Icons are cut from the supplied lockup and listed here as static files in
 * public/brand (32 px tab icon, 180 px apple-touch, 512 px installable). They are
 * deliberately NOT placed in src/app as metadata files: that would produce a
 * second, differently-sized rendition of the same logo. No /_next/image is
 * involved for the small icons.
 *
 * Metadata stays on the root layout so every route inherits it; the locale
 * layout adds the per-language title and description on top.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://lumora.example"),
  title: {
    default: "لومورا · Lumora",
    template: "%s",
  },
  description:
    "مساعد ذكي لمعلمي المرحلة الإعدادية في مدارس البحرين — Your smart assistant for Bahraini teachers.",
  applicationName: "Lumora",
  icons: {
    icon: [
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  // Pre-launch: the app itself is not public yet. The three public pages set
  // their own robots so they can be reached and shared deliberately.
  robots: { index: false, follow: false },
};

/**
 * themeColor belongs to the Viewport export in Next 14+, not to Metadata.
 * Declared here it is emitted on every route without the "Unsupported metadata
 * themeColor" warning that the old metadata entry produced on each request.
 */
export const viewport: Viewport = {
  themeColor: "#1D2A44",
};