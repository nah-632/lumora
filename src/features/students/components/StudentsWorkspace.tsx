"use client";

import { useState } from "react";
import { StudentRoster, type RosterStudent } from "./StudentRoster";
import { AddStudentDialog } from "./AddStudentDialog";

interface Props {
  locale: "ar" | "en";
  students: RosterStudent[];
  labels: Record<string, string>;
}

/**
 * Owns the roster's interactive state (dialog open, optimistic list) so the
 * page stays a server component.
 */
export function StudentsWorkspace({ locale, students, labels }: Props) {
  const [adding, setAdding] = useState(false);
  const [list, setList] = useState<RosterStudent[]>(students);

  return (
    <>
      <StudentRoster
        locale={locale}
        students={list}
        onAdd={() => setAdding(true)}
        labels={{
          title: labels.title,
          intro: labels.intro,
          add: labels.add,
          searchPlaceholder: labels.searchPlaceholder,
          filterGrade: labels.filterGrade,
          filterClass: labels.filterClass,
          filterAll: labels.filterAll,
          filterUnread: labels.filterUnread,
          alerts: labels.alerts,
          noAlerts: labels.noAlerts,
          privacyMode: labels.privacyMode,
          privacyModeHint: labels.privacyModeHint,
          empty: labels.empty,
          emptyHint: labels.emptyHint,
          emptyFiltered: labels.emptyFiltered,
          count: (n) => (locale === "ar" ? `${n} طالب` : `${n} students`),
        }}
      />

      {adding && (
        <AddStudentDialog
          locale={locale}
          onClose={() => setAdding(false)}
          onCreated={(s) => {
            setList((prev) => [...prev, s]);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}
