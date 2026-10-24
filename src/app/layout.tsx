import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "@/styles/globals.css";

/**
 * Fonts are self-hosted through next/font so no third-party request is made at
 * runtime. Arabic and Latin are paired; Arabic is never set in the Latin face.
 */
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const latin = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "لومورا · Lumora",
  description:
    "مساعد ذكي لمعلمي المرحلة الإعدادية في مدارس البحرين — Your smart assistant for Bahraini teachers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Arabic is the default locale; the middleware rewrites /en requests.
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
