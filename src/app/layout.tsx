import type { Metadata } from "next";
import "@/styles/globals.css";

/**
 * Fonts are declared as CSS variables in globals.css and resolved from the
 * system stack, so the build makes no third-party request. Self-hosted
 * next/font faces can be dropped in later by setting --font-arabic and
 * --font-latin; nothing else needs to change.
 *
 * The icons are cut from the supplied lockup and listed here as static files in
 * public/brand (32 px tab icon, 180 px apple-touch, 512 px installable). They are
 * deliberately NOT placed in src/app as metadata files: that would produce a
 * second, differently-sized rendition of the same logo. No /_next/image is
 * involved.
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
  // Next 14 carries themeColor in Metadata; the Viewport export is Next 15+.
  themeColor: "#1D2A44",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Arabic is the default locale; the middleware routes /en requests.
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
