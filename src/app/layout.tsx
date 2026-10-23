import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMORA — خدمات منزلية متكاملة",
  description: "خدمات منزلية متكاملة بجودة وموثوقية — من الصيانة والتنظيف إلى التكييف والكهرباء",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-warm-white text-charcoal antialiased">{children}</body>
    </html>
  );
}
