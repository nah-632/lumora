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

/**
 * A submission row needs its subject to be attributable to a subject. Rows
 * whose subject is absent or blank are still counted for the student, but they
 * never attach to a single subject — see signalEvidence().
 */
export interface SubjectSubmissionRow extends SubmissionRow {
  subject: string | null;
}

export interface SubjectSignal {
  subject: string;
  /** Stable grader order, so "the third assessment" means one thing. */
  ordinalStart: number;
  /** Ordinal one past the last assessment in this subject. */
  ordinalEnd: number;
  /** The grade-band value is never shown for a single mark. */
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

/** Which assessment in a subject's own sequence — "the 3rd assessment". */
export interface EvidenceAssessment {
  /** Database id of the assessment; absent when the caller has none. */
  id?: string;
  ordinal: number;
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
  // Ordinals are per (student, subject) across the whole history, computed
  // before any windowing, so they stay stable as later rows arrive.
  let ordinal = 0;
  const signals: SubjectSignal[] = subjects.map((subject) => {
    const ordinalStart = ordinal;
    const rows = (bySubject.get(subject) ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    const percentages = rows.map((r) => pct(r.score, r.maxScore));
    // A submission belongs to a subject when its subject matches. Rows without a
    // subject are counted for the student's overall picture but are not charged
    // to any single subject — otherwise every missing piece of work would be
    // reported against every subject on the roster.
    const relevantSubs = submissions.filter((s) => {
      const subjectOf = (s as SubmissionRow & { subject?: string | null }).subject;
      const sameSubject = !subjectOf || subjectOf === subject;
      return sameSubject && s.date >= (rows[0]?.date ?? "");
    });
    const missingCount = relevantSubs.filter((s) => s.status === "missing").length;
    const lateCount = relevantSubs.filter((s) => s.status === "late").length;

    ordinal += rows.length;

    if (rows.length < MIN_GRADES_PER_SUBJECT) {
      return {
        subject,
        ordinalStart,
        ordinalEnd: ordinal,
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
      ordinalStart,
      ordinalEnd: ordinal,
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

/**
 * The assessments, and the missing submissions, that a subject's signal rests on.
 *
 * Each evidence record names WHICH source rows were examined, so the claim can be
 * re-checked later against the data that produced it. The ids are the integrity
 * claim; the count is only their length.
 */
export interface SignalEvidence {
  subject: string;
  /** The half the comparison was made against (older marks). */
  baseline: EvidenceAssessment[];
  baselineAveragePct: number | null;
  /** The half compared against it (newer marks). */
  recent: EvidenceAssessment[];
  recentAveragePct: number;
  /** Missing submissions attributed to this subject, on or after its first mark. */
  missing: EvidenceAssessment[];
}

export interface EvidenceGradeRow extends GradeRow {
  /** Database id of the assessment. */
  id?: string;
}

export interface EvidenceSubmissionRow extends SubmissionRow {
  /** Database id of the submission. */
  id?: string;
  /** Rows without a subject cannot be attributed to one, so they are excluded. */
  subject?: string | null;
}

export function signalEvidence(
  subject: string,
  grades: EvidenceGradeRow[],
  submissions: EvidenceSubmissionRow[],
): SignalEvidence | null {
  const rows = grades
    .filter((g) => g.subject === subject)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.id ?? "").localeCompare(b.id ?? "");
    });
  if (rows.length === 0) return null;

  const from = rows[0].date;
  const missing = submissions
    .filter((s) => s.subject === subject && s.status === "missing" && s.date >= from)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.id ?? "").localeCompare(b.id ?? "");
    });

  const { baseline, recent } = splitHalves(rows);
  const ordinalAt = (i: number) => i + 1;

  return {
    subject,
    baseline: baseline.map((r, i) => ({ id: r.id, ordinal: ordinalAt(i) })),
    baselineAveragePct: baseline.length ? mean(baseline.map((r) => pct(r.score, r.maxScore))) : null,
    recent: recent.map((r, i) => ({ id: r.id, ordinal: ordinalAt(baseline.length + i) })),
    recentAveragePct: mean(recent.map((r) => pct(r.score, r.maxScore))),
    missing: missing.map((s, i) => ({ id: s.id, ordinal: ordinalAt(i) })),
  };
}
