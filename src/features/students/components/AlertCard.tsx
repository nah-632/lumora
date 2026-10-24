"use client";

import { useState } from "react";

export type AlertSeverity = "info" | "attention" | "urgent";
export type AlertType = "grade_drop" | "missing_work" | "positive_trend" | "follow_up";

export interface StudentAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  suggestedAction: string | null;
  evidence: string | null;
  assessmentCount: number | null;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  alert: StudentAlert;
  labels: {
    type: Record<AlertType, string>;
    severity: Record<AlertSeverity, string>;
    markRead: string;
    snooze: string;
    dismiss: string;
    dismissReason: string;
    basedOn: string;
    evidence: string;
    suggestedAction: string;
    aiNote: string;
  };
  locale: "ar" | "en";
  onAction?: (a: { action: "mark_read" | "snooze" | "dismiss"; id: string; reason?: string }) => void;
}

/**
 * Severity is carried by a word plus an icon, never by colour alone — colour-only
 * status fails WCAG 1.4.1 and is invisible to a colour-blind teacher.
 */
/**
 * Measured against the composited chip background (see DESIGN.md):
 *   info      #1D4E89 on rgba(29,78,137,.1)  -> 6.9:1
 *   attention #8A5900 on rgba(154,100,0,.1)  -> 5.25:1
 *   urgent    #B3261E on rgba(218,41,28,.1)  -> 5.55:1
 * The warning and danger tokens are darkened here because the raw values gave
 * 4.39:1 and 4.17:1, both below the 4.5:1 floor for 12px text.
 */
const SEVERITY_STYLES: Record<AlertSeverity, { chip: string; dot: string }> = {
  info: { chip: "bg-info/10 text-info", dot: "bg-info" },
  attention: { chip: "bg-warning/10 text-[#8A5900]", dot: "bg-warning" },
  urgent: { chip: "bg-danger/10 text-[#B3261E]", dot: "bg-danger" },
};

export function AlertCard({ alert, labels, locale, onAction }: Props) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const s = SEVERITY_STYLES[alert.severity];

  return (
    <article
      className="border border-[var(--lumora-line)] rounded-md bg-white p-4 [&+&]:mt-3"
      aria-labelledby={`alert-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${s.dot}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${s.chip}`}>
              {labels.severity[alert.severity]}
            </span>
            <span className="text-xs text-[var(--lumora-ink-soft)]">{labels.type[alert.alertType]}</span>
            {alert.assessmentCount != null && alert.assessmentCount > 0 && (
              <span className="text-xs text-[var(--lumora-ink-soft)] tnum">
                {labels.basedOn.replace("{count}", String(alert.assessmentCount))}
              </span>
            )}
          </div>

          <p id={`alert-${alert.id}`} className="mt-2 text-sm leading-relaxed text-[var(--lumora-ink)]">
            {alert.message}
          </p>

          {alert.evidence && (
            <p className="mt-2 text-xs text-[var(--lumora-ink-soft)]">
              <span className="font-medium">{labels.evidence}: </span>
              <bdi className="bidi-isolate tnum">{alert.evidence}</bdi>
            </p>
          )}

          {alert.suggestedAction && (
            <p className="mt-1.5 text-xs text-[var(--lumora-ink-soft)]">
              <span className="font-medium">{labels.suggestedAction}: </span>
              {alert.suggestedAction}
            </p>
          )}

          <p className="mt-3 text-[11px] text-[var(--lumora-ink-soft)]">{labels.aiNote}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!alert.isRead && (
              <button
                type="button"
                onClick={() => onAction?.({ action: "mark_read", id: alert.id })}
                className="rounded-sm border border-[var(--lumora-line)] px-2.5 py-1 text-xs font-medium transition-colors duration-fast hover:border-navy hover:text-navy"
              >
                {labels.markRead}
              </button>
            )}
            <button
              type="button"
              onClick={() => onAction?.({ action: "snooze", id: alert.id })}
              className="rounded-sm border border-[var(--lumora-line)] px-2.5 py-1 text-xs font-medium transition-colors duration-fast hover:border-navy hover:text-navy"
            >
              {labels.snooze}
            </button>
            {!dismissing ? (
              <button
                type="button"
                onClick={() => setDismissing(true)}
                className="rounded-sm px-2.5 py-1 text-xs font-medium text-[var(--lumora-ink-soft)] transition-colors duration-fast hover:text-red"
              >
                {labels.dismiss}
              </button>
            ) : (
              <form
                className="flex w-full flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reason.trim().length < 3) return;
                  onAction?.({ action: "dismiss", id: alert.id, reason: reason.trim() });
                  setDismissing(false);
                }}
              >
                <label className="sr-only" htmlFor={`reason-${alert.id}`}>
                  {labels.dismissReason}
                </label>
                <input
                  id={`reason-${alert.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={labels.dismissReason}
                  className="min-w-0 flex-1 rounded-sm border border-[var(--lumora-line)] px-2.5 py-1 text-xs"
                  required
                  minLength={3}
                  maxLength={500}
                />
                <button
                  type="submit"
                  className="rounded-sm bg-navy px-2.5 py-1 text-xs font-medium text-white transition-opacity duration-fast hover:opacity-90"
                >
                  {labels.dismiss}
                </button>
                <button
                  type="button"
                  onClick={() => { setDismissing(false); setReason(""); }}
                  className="rounded-sm px-2.5 py-1 text-xs text-[var(--lumora-ink-soft)] hover:text-navy"
                >
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
