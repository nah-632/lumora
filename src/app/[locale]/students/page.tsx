import { getTranslations } from "next-intl/server";
import { StudentsWorkspace } from "@/features/students/components/StudentsWorkspace";
import type { RosterStudent } from "@/features/students/components/StudentRoster";

/**
 * Roster page. Data access is server-side; the teacher's session authorises every
 * read through RLS, so a missing or invalid session yields an empty list rather
 * than another teacher's records.
 */
export default async function StudentsPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "students" });

  // TODO(integration): replace with the real query once the auth session is wired.
  const students: RosterStudent[] = [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <StudentsWorkspace
        locale={locale}
        students={students}
        labels={{
          title: t("title"),
          intro: t("intro"),
          add: t("add"),
          searchPlaceholder: t("searchPlaceholder"),
          filterGrade: t("filterGrade"),
          filterClass: t("filterClass"),
          filterAll: t("filterAll"),
          filterUnread: t("filterUnread"),
          alerts: t("alerts"),
          noAlerts: t("noAlerts"),
          privacyMode: t("privacyMode"),
          privacyModeHint: t("privacyModeHint"),
          empty: t("empty"),
          emptyHint: t("emptyHint"),
          emptyFiltered: t("emptyFiltered"),
          countLabel: t("count", { count: 0 }),
        }}
      />
    </main>
  );
}
