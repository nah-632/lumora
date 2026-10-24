import type { Metadata } from "next";
import { LumoraMark } from "@/components/brand/LumoraMark";

/**
 * Brand assets — static proof that the supplied artwork is wired in and usable.
 *
 * Two concrete reasons this page exists: it renders every asset the app actually
 * references at its real dimensions, so a broken path or a misplaced file is
 * visible in a browser rather than argued about in a diff; and it lists each
 * file's role, so "is the logo used?" has an answer that is not a claim.
 *
 * It reads nothing and stores nothing. `force-static` keeps it that way.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Brand assets · Lumora",
  robots: { index: false, follow: false },
};

const ASSETS = [
  {
    file: "/brand/lumora-logo.webp",
    roleAr: "الشعار الكامل (الرمز + الاسم + الشعار النصي) — الصفحات العامة",
    roleEn: "Full lockup (mark + wordmark + tagline) — public pages",
    width: 512,
    height: 512,
  },
  {
    file: "/brand/lumora-mark-generated@96.png",
    roleAr: "الرمز وحده بخلفية شفافة — رأس الصفحات",
    roleEn: "Mark alone, transparent — page headers",
    width: 96,
    height: 96,
  },
  {
    file: "/brand/hero-bulb.webp",
    roleAr: "صورة الهيرو — صفحة «عن لومورا»",
    roleEn: "Hero photograph — About page",
    width: 1600,
    height: 893,
  },
  {
    file: "/brand/lesson-plans-desk.webp",
    roleAr: "صورة المكتب — محفوظة للصفحات التمهيدية",
    roleEn: "Desk photograph — held for the introductory pages",
    width: 1600,
    height: 893,
  },
  {
    file: "/brand/features-3d.webp",
    roleAr: "صورة الميزات — محفوظة للصفحات التمهيدية",
    roleEn: "Features artwork — held for the introductory pages",
    width: 1200,
    height: 670,
  },
  {
    file: "/brand/icon-32.png",
    roleAr: "أيقونة التبويب ٣٢ بكسل",
    roleEn: "Favicon, 32 px",
    width: 32,
    height: 32,
  },
  {
    file: "/brand/icon-180.png",
    roleAr: "أيقونة الشاشة الرئيسية ١٨٠ بكسل",
    roleEn: "Home-screen icon, 180 px",
    width: 180,
    height: 180,
  },
] as const;

export default async function BrandAssetsPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const ar = locale === "ar";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "أصول الهوية البصرية" : "Brand assets"}</h1>
      <p className="mt-2 text-sm text-[var(--lumora-ink-soft)]">
        {ar
          ? "كل ملف هنا مستخدم فعليًا أو محفوظ لصفحة محددة، بأبعاده الحقيقية."
          : "Every file here is either in use or held for a named page, at its real dimensions."}
      </p>

      <dl className="mt-8 grid gap-6">
        {ASSETS.map((a) => (
          <div key={a.file} className="rounded-lg border border-[var(--lumora-line)] bg-white p-4">
            <dt className="text-xs text-[var(--lumora-ink-soft)]">{ar ? a.roleAr : a.roleEn}</dt>
            <dd className="mt-3">
              <img
                src={a.file}
                alt=""
                width={a.width}
                height={a.height}
                className="max-h-40 w-auto border border-[var(--lumora-line)]"
                decoding="async"
              />
              <code className="mt-2 block text-[11px] text-[var(--lumora-ink-soft)]" dir="ltr">
                {a.file} — {a.width}×{a.height}
              </code>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 flex items-center gap-2 text-xs text-[var(--lumora-ink-soft)]">
        <LumoraMark locale={locale} size={24} withWordmark />
        <span dir="ltr">favicon.ico · icon.png · apple-icon.png</span>
      </p>
    </main>
  );
}