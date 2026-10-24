import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { createSessionClient } from "@/lib/auth/server";
import { AlertSettingsForm } from "@/features/students/components/AlertSettingsForm";

// Every page here depends on the request (session cookie or locale), so it
// must never be prerendered. Without this Next attempts to render these at
// build time, where cookies() and the auth client are unavailable, and the
// prerender worker stalls.
export const dynamic = "force-dynamic";


export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  await requireUser(locale, `/${locale}/settings`);

  const supabase = await createSessionClient();
  let threshold = 20;
  if (supabase) {
    const { data } = await supabase
      .from("teacher_alert_settings")
      .select("drop_threshold_pct")
      .maybeSingle();
    if (data) threshold = (data as { drop_threshold_pct: number }).drop_threshold_pct;
  }

  const t = await getTranslations({ locale, namespace: "insights" });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <AlertSettingsForm
        locale={locale}
        initialThreshold={threshold}
        labels={{
          title: t("sensitivity"),
          hint: t("sensitivityHint"),
          save: locale === "ar" ? "حفظ" : "Save",
          saving: locale === "ar" ? "جارٍ الحفظ…" : "Saving…",
          saved: locale === "ar" ? "تم الحفظ." : "Saved.",
          failed: locale === "ar" ? "تعذّر الحفظ." : "Could not save.",
        }}
      />
    </main>
  );
}
