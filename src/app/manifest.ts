import type { MetadataRoute } from "next";

/**
 * Web app manifest. Icons are the static files in public/brand, served as-is —
 * no image optimization is involved, by design (see ADR-010).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "لومورا · Lumora",
    short_name: "Lumora",
    description:
      "مساعد ذكي لمعلمي المرحلة الإعدادية في مدارس البحرين — Your smart assistant for Bahraini teachers.",
    start_url: "/ar/students",
    display: "standalone",
    background_color: "#F8F9FA",
    theme_color: "#1D2A44",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: "/brand/icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
