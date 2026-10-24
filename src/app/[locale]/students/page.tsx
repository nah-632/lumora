import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { createSessionClient } from "@/lib/auth/server";
import { StudentsWorkspace } from "@/features/students/components/StudentsWorkspace";
import type { RosterStudent } from "@/features/students/components/StudentRoster";

/**
 * Roster page.
 *
 * The session guard runs first, then every read carries the teacher's own token
 * so RLS decides what is returned. No service_role client is reachable here.
 */
export default async function StudentsPage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/students`);
  const t = await getTranslations({ locale, namespace: "students" });

  const supabase = await createSessionClient();
  let students: RosterStudent[] = [];

  if (supabase) {
    // Unread alert counts come from a single grouped fetch rather than a query
    // per student, so the page does not degrade as the roster grows.
    const [{ data: rows }, { data: alertRows }] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, grade_level, class_label")
        .order("created_at", { ascending: false }),
      supabase
        .from("student_alerts")
        .select("student_id")
        .eq("is_read", false)
        .is("dismissed_at", null),
    ]);

    const unread = new Map<string, number>();
    for (const a of alertRows ?? []) {
      const id = (a as { student_id: string }).student_id;
      unread.set(id, (unread.get(id) ?? 0) + 1);
    }

    students = (rows ?? []).map((r) => {
      const row = r as { id: string; name: string; grade_level: string; class_label: string | null };
      return {
        id: row.id,
        name: row.name,
        gradeLevel: row.grade_level,
        classLabel: row.class_label,
        unreadAlerts: unread.get(row.id) ?? 0,
        gradeCount: 0,
      };
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <StudentsWorkspace
        locale={locale}
        students={students}
        teacherEmail={user.email ?? ""}
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
          signOut: t("signOut"),
        }}
      />
    </main>
  );
}
