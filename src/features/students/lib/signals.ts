/**
 * Deterministic signal computation.
 *
 * ALL arithmetic happens here, in code. The model receives finished percentages
 * and counts and only interprets them — so a model error can never produce a
 * wrong number, only a wrong sentence.
 *
 * Privacy: this module never returns a student name. Students are represented by
 * an opaque ref allocated by the caller.
 */

export interface GradeRow {
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  date: string;
}

export interface SubmissionRow {
  studentId: string;
  status: "submitted" | "late" | "missing";
  date: string;
}

export interface SubjectSignal {
  subject: string;
  recentAveragePct: number;
  baselineAveragePct: number | null;
  deltaPct: number | null;
  gradesConsidered: number;
  missingCount: number;
  lateCount: number;
  trend: "improving" | "declining" | "steady" | "insufficient_data";
}

export interface StudentSignal {
  ref: string;
  gradeLevel: string;
  signals: SubjectSignal[];
}

/** Minimum grades per subject before a delta is meaningful. */
export const MIN_GRADES_PER_SUBJECT = 3;
/** Default drop threshold in percentage points; per-teacher configurable. */
export const DEFAULT_DROP_THRESHOLD_PCT = 20;
/** Missing submissions at or above this count raise a missing_work signal. */
export const MISSING_WORK_THRESHOLD = 2;

const pct = (score: number, max: number): number =>
  max <= 0 ? 0 : Math.round((score / max) * 1000) / 10;

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

/**
 * Splits a subject's grades into an older baseline half and a recent half, so a
 * delta compares like with like rather than measuring noise between two marks.
 */
function splitHalves<T>(rows: T[]): { baseline: T[]; recent: T[] } {
  const sorted = [...rows];
  const mid = Math.floor(sorted.length / 2);
  return { baseline: sorted.slice(0, mid), recent: sorted.slice(mid) };
}

export function computeStudentSignals(
  ref: string,
  gradeLevel: string,
  grades: GradeRow[],
  submissions: SubmissionRow[],
  dropThresholdPct: number = DEFAULT_DROP_THRESHOLD_PCT,
): StudentSignal {
  const bySubject = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const list = bySubject.get(g.subject) ?? [];
    list.push(g);
    bySubject.set(g.subject, list);
  }

  const subjects = [...bySubject.keys()].sort((a, b) => a.localeCompare(b));
  const signals: SubjectSignal[] = subjects.map((subject) => {
    const rows = (bySubject.get(subject) ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    const percentages = rows.map((r) => pct(r.score, r.maxScore));
    const relevantSubs = submissions.filter((s) => s.date >= (rows[0]?.date ?? ""));
    const missingCount = relevantSubs.filter((s) => s.status === "missing").length;
    const lateCount = relevantSubs.filter((s) => s.status === "late").length;

    if (rows.length < MIN_GRADES_PER_SUBJECT) {
      return {
        subject,
        recentAveragePct: mean(percentages),
        baselineAveragePct: null,
        deltaPct: null,
        gradesConsidered: rows.length,
        missingCount,
        lateCount,
        trend: "insufficient_data" as const,
      };
    }

    const { baseline, recent } = splitHalves(percentages);
    const baselineAvg = mean(baseline);
    const recentAvg = mean(recent);
    const delta = Math.round((recentAvg - baselineAvg) * 10) / 10;

    const trend: SubjectSignal["trend"] =
      delta <= -dropThresholdPct ? "declining" : delta >= dropThresholdPct ? "improving" : "steady";

    return {
      subject,
      recentAveragePct: recentAvg,
      baselineAveragePct: baselineAvg,
      deltaPct: delta,
      gradesConsidered: rows.length,
      missingCount,
      lateCount,
      trend,
    };
  });

  return { ref, gradeLevel, signals };
}

/** True when a subject carries at least one signal worth the model's attention. */
export function isNotable(s: SubjectSignal): boolean {
  if (s.trend === "declining" || s.trend === "improving") return true;
  if (s.missingCount >= MISSING_WORK_THRESHOLD) return true;
  return false;
}

/**
 * Builds a stable dedupe key from the deterministic signal. Regenerating alerts
 * over unchanged data yields the same key, and the unique index on
 * (student_id, alert_type, dedupe_key) makes the insert a no-op.
 */
export function buildDedupeKey(s: SubjectSignal): string {
  return [
    s.subject.toLowerCase().replace(/\s+/g, "_"),
    s.trend,
    String(s.recentAveragePct),
    String(s.baselineAveragePct ?? "na"),
    String(s.gradesConsidered),
    String(s.missingCount),
  ].join(":");
}
