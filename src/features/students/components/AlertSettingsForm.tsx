"use client";

import { useState } from "react";

interface Props {
  locale: "ar" | "en";
  initialThreshold: number;
  labels: { title: string; hint: string; save: string; saving: string; saved: string; failed: string };
}

/**
 * Per-teacher drop sensitivity. The value is used by the deterministic signal
 * computation, so changing it changes what the analysis considers notable —
 * it never changes the arithmetic itself.
 */
export function AlertSettingsForm({ initialThreshold, labels }: Props) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/alert-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dropThresholdPct: threshold }),
      });
      setNotice(res.ok ? { ok: true, text: labels.saved } : { ok: false, text: labels.failed });
    } catch {
      setNotice({ ok: false, text: labels.failed });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-[var(--lumora-line)] bg-white p-5">
      <h1 className="text-base font-semibold text-navy">{labels.title}</h1>
      <p className="mt-1 max-w-[62ch] text-sm text-[var(--lumora-ink-soft)]">{labels.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="sr-only" htmlFor="threshold">{labels.title}</label>
        <input
          id="threshold"
          type="range"
          min={1}
          max={100}
          step={1}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full max-w-xs accent-[#DA291C]"
        />
        <output htmlFor="threshold" className="text-sm font-semibold text-navy tnum">
          {threshold}%
        </output>
      </div>

      {notice && (
        <p role="status" className={`mt-3 text-sm ${notice.ok ? "text-success" : "text-[#B3261E]"}`}>
          {notice.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
      >
        {saving ? labels.saving : labels.save}
      </button>
    </form>
  );
}
