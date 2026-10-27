"use client";

import { useState, useTransition } from "react";
import { StudentRoster, type RosterStudent } from "./StudentRoster";
import { AddStudentDialog } from "./AddStudentDialog";
import { StudentProfile } from "./StudentProfile";
import { signOutAction } from "@/lib/auth/actions";

interface Props {
  locale: "ar" | "en";
  students: RosterStudent[];
  teacherEmail: string;
  labels: Record<string, string>;
}

type View = { kind: "roster" } | { kind: "profile"; student: RosterStudent };

/**
 * Owns the roster's interactive state (dialog, optimistic list, which profile is
 * open) so the page itself can stay a server component.
 */
export function StudentsWorkspace({ locale, students, teacherEmail, labels }: Props) {
  const [adding, setAdding] = useState(false);
  const [list, setList] = useState<RosterStudent[]>(students);
  const [view, setView] = useState<View>({ kind: "roster" });
  const [pendingSignOut, startSignOut] = useTransition();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--lumora-ink-soft)]" dir="ltr">
          {teacherEmail}
        </span>
        <button
          type="button"
          onClick={() => startSignOut(() => void signOutAction(locale))}
          disabled={pendingSignOut}
          className="rounded-md border border-[var(--lumora-line)] px-3 py-1.5 text-xs font-medium text-[var(--lumora-ink)] transition-colors duration-fast hover:border-navy disabled:opacity-50"
        >
          {labels.signOut}
        </button>
      </div>

      {view.kind === "roster" ? (
        <StudentRoster
          locale={locale}
          students={list}
          onAdd={() => setAdding(true)}
          onOpen={(id) => {
            const found = list.find((s) => s.id === id);
            if (found) setView({ kind: "profile", student: found });
          }}
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
      ) : (
        <StudentProfile
          locale={locale}
          student={view.student}
          onBack={() => setView({ kind: "roster" })}
        />
      )}

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
