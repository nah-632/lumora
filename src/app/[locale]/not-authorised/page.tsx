import { getTranslations } from "next-intl/server";

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
