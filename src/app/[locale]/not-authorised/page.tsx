import { getTranslations } from "next-intl/server";

// Every page here depends on the request (session cookie or locale), so it
// must never be prerendered. Without this Next attempts to render these at
// build time, where cookies() and the auth client are unavailable, and the
// prerender worker stalls.
export const dynamic = "force-dynamic";


export default async function NotAuthorisedPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold text-navy">{t("notAuthorised")}</h1>
    </main>
  );
}
