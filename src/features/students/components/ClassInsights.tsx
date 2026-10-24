"use client";

interface SubjectFollowUp {
  subject: string;
  studentCount: number;
}

export interface InsightSummary {
  /** Subjects with at least one declining student, count descending. */
  followUp: SubjectFollowUp[];
  /** Students showing a sustained improvement. */
  improvingCount: number;
  /** Assessments the summary rests on, so the teacher can judge the basis. */
  basedOnAssessments: number;
}

type State =
  | { kind: "loading" }
  | { kind: "not_configured" }
  | { kind: "quota_exceeded" }
  | { kind: "no_data" }
  | { kind: "ready"; summary: InsightSummary };

interface Props {
  state: State;
  labels: {
    title: string;
    review: string;
    notConfigured: string;
    quota: string;
    noData: string;
    followUp: (count: number, subject: string) => string;
    positive: (count: number) => string;
  };
  onReview?: () => void;
  generating?: boolean;
}

/**
 * Only real figures are ever rendered. There is no placeholder statistic and no
 * zero-state that could be mistaken for a measured result — a count is shown
 * only when a matching query returned it.
 */
export function ClassInsights({ state, labels, onReview, generating }: Props) {
  return (
    <section
      className="rounded-lg border border-[var(--lumora-line)] bg-white p-5"
      aria-labelledby="insights-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="insights-title" className="text-base font-semibold text-navy">
          {labels.title}
        </h2>
        <button
          type="button"
          onClick={onReview}
          disabled={generating || state.kind === "not_configured"}
          className="rounded-md bg-navy px-3.5 py-1.5 text-sm font-medium text-white transition-opacity duration-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {labels.review}
        </button>
      </div>

      <div className="mt-4">
        {state.kind === "loading" && (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-5 w-1/2" />
          </div>
        )}

        {state.kind === "not_configured" && (
          <p className="text-sm text-[var(--lumora-ink-soft)]">{labels.notConfigured}</p>
        )}

        {state.kind === "quota_exceeded" && (
          <p className="text-sm text-[var(--lumora-ink-soft)]">{labels.quota}</p>
        )}

        {state.kind === "no_data" && (
          <p className="text-sm text-[var(--lumora-ink-soft)]">{labels.noData}</p>
        )}

        {state.kind === "ready" && (
          <ul className="space-y-2">
            {state.summary.followUp.map((f) => (
              <li key={f.subject} className="flex items-start gap-2.5 text-sm text-[var(--lumora-ink)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" aria-hidden="true" />
                <span>{labels.followUp(f.studentCount, f.subject)}</span>
              </li>
            ))}
            {state.summary.improvingCount > 0 && (
              <li className="flex items-start gap-2.5 text-sm text-[var(--lumora-ink)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-success" aria-hidden="true" />
                <span>{labels.positive(state.summary.improvingCount)}</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
