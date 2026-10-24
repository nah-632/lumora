import type { Metadata } from "next";
import "@/styles/globals.css";

/**
 * Fonts are declared as CSS variables in globals.css and resolved from the
 * device/system stack, so the build makes no third-party request. Self-hosted
 * next/font faces can be dropped in later by setting --font-arabic and
 * --font-latin; nothing else needs to change.
 */
export const metadata: Metadata = {
  title: "لومورا · Lumora",
  description:
    "مساعد ذكي لمعلمي المرحلة الإعدادية في مدارس البحرين — Your smart assistant for Bahraini teachers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Arabic is the default locale; the middleware routes /en requests.
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
