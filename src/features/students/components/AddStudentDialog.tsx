"use client";

import { useEffect, useRef, useState } from "react";
import type { RosterStudent } from "./StudentRoster";

interface Props {
  locale: "ar" | "en";
  onClose: () => void;
  onCreated: (s: RosterStudent) => void;
}

const COPY = {
  ar: {
    title: "طالب جديد",
    name: "الاسم",
    gradeLevel: "الصف الدراسي",
    classLabel: "الفصل (اختياري)",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    required: "هذا الحقل مطلوب.",
    invalid: "البيانات المدخلة غير صحيحة. تحقق من الحقول وحاول مرة أخرى.",
    failed: "حدث خطأ غير متوقع. حاول مرة أخرى.",
  },
  en: {
    title: "New student",
    name: "Name",
    gradeLevel: "Grade level",
    classLabel: "Class (optional)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    required: "This field is required.",
    invalid: "The submitted data is not valid. Check the fields and try again.",
    failed: "Something went wrong. Please try again.",
  },
} as const;

/**
 * A dialog is justified here: protected focus and an interruption that keeps the
 * teacher from losing their place in the roster.
 */
export function AddStudentDialog({ locale, onClose, onCreated }: Props) {
  const c = COPY[locale];
  const first = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !gradeLevel.trim()) {
      setError(c.required);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), gradeLevel: gradeLevel.trim(), classLabel: classLabel.trim() }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.ok) {
        const code = body?.code;
        setError(code === "invalid_input" ? c.invalid : c.failed);
        return;
      }

      onCreated({
        id: body.data.id,
        name: body.data.name,
        gradeLevel: body.data.gradeLevel,
        classLabel: body.data.classLabel ?? null,
        unreadAlerts: 0,
        gradeCount: 0,
      });
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-student-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-lg bg-white p-5 sm:rounded-lg">
        <h2 id="add-student-title" className="text-lg font-semibold text-navy">{c.title}</h2>

        <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="s-name" className="block text-sm font-medium">{c.name}</label>
            <input
              id="s-name"
              ref={first}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="s-grade" className="block text-sm font-medium">{c.gradeLevel}</label>
            <input
              id="s-grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              maxLength={40}
              required
              className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="s-class" className="block text-sm font-medium">{c.classLabel}</label>
            <input
              id="s-class"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              maxLength={40}
              className="mt-1 w-full rounded-md border border-[var(--lumora-line)] px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-red px-4 py-2 text-sm font-medium text-white transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
            >
              {busy ? c.saving : c.save}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-[var(--lumora-ink-soft)] transition-colors duration-fast hover:text-navy"
            >
              {c.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
