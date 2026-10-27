/**
 * basis_kind / basis_count — what an alert rests on.
 *
 * The product statement is a sentence: "Based on N assessments" or
 * "Based on N submissions". So the basis is a COUNT OF SOURCE RECORDS paired
 * with the KIND of record counted. Both are computed here, from the same rows the
 * signal came from, in code — never by the model and never by the client.
 *
 * When the count cannot be established the basis is null and the UI renders no
 * line at all. An absent sentence is honest; an invented number is not.
 */

export type BasisKind = "assessments" | "submissions";

export interface AlertBasis {
  kind: BasisKind;
  count: number;
}

/**
 * Which kind of record each alert type points at directly:
 *
 *   missing_work    -> the missing submissions it counted
 *   grade_drop      -> the assessments it compared
 *   positive_trend  -> the assessments it compared
 *   follow_up       -> resolved below, and only when one kind is in play
 */
const DIRECT_KIND: Record<string, BasisKind | "by-evidence"> = {
  missing_work: "submissions",
  grade_drop: "assessments",
  positive_trend: "assessments",
  follow_up: "by-evidence",
};

/** Minimum notable values on each side of a split before a trend is claimed. */
export const DEFAULT_TREND_THRESHOLD_PCT = 20;
/** Missing submissions at or above this count raise a missing-work signal. */
export const DEFAULT_MISSING_WORK_THRESHOLD = 2;

interface FiringSignal {
  trend: "improving" | "declining" | "steady" | "insufficient_data";
  missingCount: number;
}

/**
 * Whether a subject's signal satisfies an alert type at all.
 *
 * This is the same rule the generator uses to decide a student is worth sending,
 * applied per alert type. Without it a model could ask for "missing work" on a
 * subject that has none, and the basis would point at records that do not
 * explain the sentence.
 */
export function isFiringFor(signal: FiringSignal, alertType: string): boolean {
  switch (alertType) {
    case "missing_work":
      return signal.missingCount >= DEFAULT_MISSING_WORK_THRESHOLD;
    case "grade_drop":
      return signal.trend === "declining";
    case "positive_trend":
      return signal.trend === "improving";
    case "follow_up":
      return (
        signal.trend === "declining" ||
        signal.trend === "improving" ||
        signal.missingCount >= DEFAULT_MISSING_WORK_THRESHOLD
      );
    default:
      return false;
  }
}

export interface RequiredSources {
  /** Which halves of the assessment series the alert compared. */
  assessments: Array<"baseline" | "recent" | "missing">;
  /** Present when the alert is a missing-work claim. */
  submissions: boolean;
}

export function requiredSourcesFor(
  signal: FiringSignal & {
    ordinalStart: number;
    ordinalEnd: number;
  },
  alertType: string,
  trendThresholdPct: number = DEFAULT_TREND_THRESHOLD_PCT,
  missingThreshold: number = DEFAULT_MISSING_WORK_THRESHOLD,
): RequiredSources {
  const total = signal.ordinalEnd - signal.ordinalStart;
  const halves: Array<"baseline" | "recent"> =
    total >= 2 ? ["baseline", "recent"] : total === 1 ? ["recent"] : [];
  const missing = signal.missingCount >= missingThreshold;

  switch (alertType) {
    case "missing_work":
      return { assessments: missing ? ["missing"] : [], submissions: missing };
    case "grade_drop":
      return { assessments: signal.trend === "declining" ? halves : [], submissions: false };
    case "positive_trend":
      return { assessments: signal.trend === "improving" ? halves : [], submissions: false };
    case "follow_up": {
      const notableHalves: Array<"baseline" | "recent"> = halves.filter((h) => h === "baseline" || h === "recent");
      return { assessments: notableHalves, submissions: missing };
    }
    default:
      return { assessments: [], submissions: false };
  }
}

export interface BasisInput {
  alertType: string;
  /** Assessments examined for the subject this alert is about. */
  gradesConsidered: number;
  /** Missing submissions counted for the subject this alert is about. */
  missingCount: number;
  /** Whether that subject carried a notable missing-work signal. */
  missingIsNotable: boolean;
}

export function computeBasis(input: BasisInput): AlertBasis | null {
  const rule = DIRECT_KIND[input.alertType];
  if (!rule) return null;

  const grades = Math.max(0, Math.trunc(input.gradesConsidered));
  const missing = Math.max(0, Math.trunc(input.missingCount));

  if (rule === "assessments") {
    return grades > 0 ? { kind: "assessments", count: grades } : null;
  }
  if (rule === "submissions") {
    return missing > 0 ? { kind: "submissions", count: missing } : null;
  }

  // follow_up: commit to a kind only when exactly one kind is in play. When both
  // are, the alert does not name one, so no sentence is produced.
  const hasAssessments = grades > 0;
  const hasMissing = input.missingIsNotable && missing > 0;
  if (hasAssessments && !hasMissing) return { kind: "assessments", count: grades };
  if (hasMissing && !hasAssessments) return { kind: "submissions", count: missing };
  return null;
}