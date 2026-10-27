"use client";

import { useMemo, useState } from "react";

export interface RosterStudent {
  id: string;
  name: string;
  gradeLevel: string;
  classLabel: string | null;
  unreadAlerts: number;
  gradeCount: number;
}

interface Props {
  students: RosterStudent[];
  labels: {
    title: string;
    intro: string;
    add: string;
    searchPlaceholder: string;
    filterGrade: string;
    filterClass: string;
    filterAll: string;
    filterUnread: string;
    alerts: string;
    noAlerts: string;
    privacyMode: string;
    privacyModeHint: string;
    empty: string;
    emptyHint: string;
    emptyFiltered: string;
    count: (n: number) => string;
  };
  onOpen?: (id: string) => void;
  onAdd?: () => void;
  loading?: boolean;
  locale?: "ar" | "en";
}

/**
 * Privacy mode replaces names with a stable code derived from the id, so a
 * teacher can share their screen without exposing a minor's identity. The code
 * is stable for a given student within the session.
 */
function codeFor(id: string, locale: "ar" | "en"): string {
  const n = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return locale === "ar" ? `الطالب ${n}` : `Student ${n}`;
}

export function StudentRoster({ students, labels, onOpen, onAdd, loading, locale = "ar" }: Props) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string>("__all__");
  const [cls, setCls] = useState<string>("__all__");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const grades = useMemo(
    () => [...new Set(students.map((s) => s.gradeLevel))].sort(),
    [students],
  );
  const classes = useMemo(
    () => [...new Set(students.map((s) => s.classLabel).filter(Boolean) as string[])].sort(),
    [students],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (grade !== "__all__" && s.gradeLevel !== grade) return false;
      if (cls !== "__all__" && s.classLabel !== cls) return false;
      if (unreadOnly && s.unreadAlerts === 0) return false;
      return true;
    });
  }, [students, query, grade, cls, unreadOnly]);

  const display = (s: RosterStudent) => (privacy ? codeFor(s.id, locale) : s.name);

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <div className="skeleton h-10 w-64" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">{labels.title}</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-[var(--lumora-ink-soft)]">{labels.intro}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md bg-red px-4 py-2 text-sm font-medium text-white transition-opacity duration-fast hover:opacity-90"
        >
          {labels.add}
        </button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="roster-search">
          {labels.searchPlaceholder}
        </label>
        <input
          id="roster-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="w-full max-w-xs rounded-md border border-[var(--lumora-line)] bg-white px-3 py-2 text-sm"
        />

        <label className="sr-only" htmlFor="roster-grade">{labels.filterGrade}</label>
        <select
          id="roster-grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded-md border border-[var(--lumora-line)] bg-white px-3 py-2 text-sm"
        >
          <option value="__all__">{labels.filterAll}</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {classes.length > 0 && (
          <>
            <label className="sr-only" htmlFor="roster-class">{labels.filterClass}</label>
            <select
              id="roster-class"
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              className="rounded-md border border-[var(--lumora-line)] bg-white px-3 py-2 text-sm"
            >
              <option value="__all__">{labels.filterAll}</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-[var(--lumora-ink-soft)]">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="h-4 w-4 rounded-sm"
          />
          {labels.filterUnread}
        </label>

        <label
          className="ms-auto inline-flex items-center gap-2 text-sm text-[var(--lumora-ink-soft)]"
          title={labels.privacyModeHint}
        >
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="h-4 w-4 rounded-sm"
          />
          {labels.privacyMode}
        </label>
      </div>

      <p className="mt-4 text-xs text-[var(--lumora-ink-soft)] tnum" aria-live="polite">
        {labels.count(visible.length)}
      </p>

      {students.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-[var(--lumora-line)] bg-white p-8 text-center">
          <p className="text-sm font-medium text-navy">{labels.empty}</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-sm text-[var(--lumora-ink-soft)]">{labels.emptyHint}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-[var(--lumora-line)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--lumora-ink-soft)]">{labels.emptyFiltered}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((s) => {
            const name = display(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpen?.(s.id)}
                  /* colour pinned: Safari gives button text its accent blue */
                  className="flex w-full items-center gap-4 rounded-md border border-[var(--lumora-line)] bg-white px-4 py-3 text-start text-[var(--lumora-ink)] transition-colors duration-fast hover:border-navy/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">
                      <bdi className="bidi-isolate">{name}</bdi>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--lumora-ink-soft)]">
                      <bdi className="bidi-isolate">{s.gradeLevel}</bdi>
                      {s.classLabel ? ` · ${s.classLabel}` : ""}
                    </span>
                  </span>

                  {s.unreadAlerts > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-red/10 px-2.5 py-1 text-xs font-semibold text-[#B3261E]">
                      <span className="tnum">{s.unreadAlerts}</span>
                      <span className="sr-only">{labels.alerts}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--lumora-ink-soft)]">{labels.noAlerts}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
