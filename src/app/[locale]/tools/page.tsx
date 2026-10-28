import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { ToolsWorkspace } from "@/features/tools/components/ToolsWorkspace";
import { SiteFooter } from "@/components/SiteFooter";
import { LumoraMark } from "@/components/brand/LumoraMark";

// Depends on the session cookie, so it must never be prerendered. Without this
// Next attempts a build-time render where cookies() is unavailable.
export const dynamic = "force-dynamic";

const AI_CONFIGURED = Boolean(
  (process.env.AI_API_KEY ?? process.env.HUGGINGFACE_API_KEY ?? "").trim(),
);

/**
 * Teacher tools page.
 *
 * Guarded here rather than relying on middleware alone, and laid out to match the
 * roster page so the dashboard feels like one product.
 *
 * The feature is deliberately not a chat: every input is a predefined choice with
 * at most one short optional field, and the output is a document to review, edit
 * and print. That shape is what keeps the generation cheap enough to be usable
 * and the result reviewable by a teacher who is accountable for it.
 *
 * The provider key is checked server-side and passed down as a boolean, so an
 * unconfigured deployment explains itself instead of offering a button that
 * returns 503.
 */
export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  await requireUser(locale, `/${locale}/tools`);
  const t = await getTranslations({ locale, namespace: "tools" });

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <LumoraMark locale={locale} href={`/${locale}`} size={32} />
        </div>

        <header className="tools-page-head">
          <h1 className="tools-page-title">{t("title")}</h1>
          <p className="tools-page-intro">{t("intro")}</p>
        </header>

        {AI_CONFIGURED ? (
          <ToolsWorkspace locale={locale} />
        ) : (
          <p className="tools-unavailable" role="status">
            {t("notices.unavailable")}
          </p>
        )}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
