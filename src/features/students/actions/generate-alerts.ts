/**
 * Alert generation: deterministic signals in, validated AI interpretation out.
 *
 * Privacy by design — the payload sent to the provider contains an opaque ref
 * (s1, s2...), grade level, percentages and counts. Student names, free-text
 * feedback and project names never leave this process. Refs are mapped back to
 * student ids here, and any ref the model invents is dropped.
 *
 * This module is intentionally pure: data access is injected so the logic can be
 * tested without a database.
 */

import {
  alertsModelOutputSchema,
  type AlertModelItem,
  type ErrorCode,
} from "../schemas";
import {
  STUDENT_ALERTS_PROMPT_VERSION,
  STUDENT_ALERTS_SYSTEM_PROMPT,
  buildAlertsUserMessage,
  type AlertsInputEnvelope,
} from "@/lib/ai/prompts/student-alerts";
import {
  computeStudentSignals,
  buildDedupeKey,
  isNotable,
  type GradeRow,
  type SubmissionRow,
  type StudentSignal,
  type SubjectSignal,
} from "../lib/signals";
import type { AIProvider } from "@/lib/ai/provider";

export interface CandidateStudent {
  id: string;
  gradeLevel: string;
  grades: GradeRow[];
  submissions: SubmissionRow[];
}

export interface PreparedAlert {
  studentId: string;
  alertType: AlertModelItem["alertType"];
  severity: AlertModelItem["severity"];
  message: string;
  suggestedAction: string | null;
  evidence: string | null;
  assessmentCount: number;
  dedupeKey: string;
  promptVersion: string;
}

export interface GenerateDeps {
  provider: AIProvider | null;
  /** Called for each provider invocation so the caller can log generation_runs. */
  onRun?: (info: { promptVersion: string; provider: string; model: string; latencyMs: number }) => void;
}

export interface GenerateResult {
  ok: boolean;
  code?: ErrorCode;
  prepared: PreparedAlert[];
  /** For diagnostics and tests only — never rendered to the user. */
  diagnostics: {
    studentsSent: number;
    studentsSkipped: number;
    refsDropped: number;
    payloadHadNames: boolean;
  };
}

/** Assigns stable opaque refs and filters to students with notable signals. */
export function prepareSignals(
  candidates: CandidateStudent[],
  dropThresholdPct: number,
): { signals: StudentSignal[]; byRef: Map<string, CandidateStudent> } {
  const byRef = new Map<string, CandidateStudent>();
  const signals: StudentSignal[] = [];
  let n = 0;

  for (const c of candidates) {
    const sig = computeStudentSignals(c.id, c.gradeLevel, c.grades, c.submissions, dropThresholdPct);
    if (!sig.signals.some(isNotable)) continue;

    n += 1;
    const ref = `s${n}`;
    const renamed: StudentSignal = { ...sig, ref };
    byRef.set(ref, c);
    signals.push(renamed);
  }

  return { signals, byRef };
}

/**
 * Guards the privacy promise in code rather than in a comment: if a student name
 * somehow reached the payload, the call is aborted instead of sent.
 */
export function payloadContainsNames(payload: string, names: string[]): boolean {
  const hay = payload.toLowerCase();
  return names.some((n) => {
    const needle = n.trim().toLowerCase();
    return needle.length >= 2 && hay.includes(needle);
  });
}

export async function generateAlerts(
  candidates: CandidateStudent[],
  names: string[],
  locale: "ar" | "en",
  dropThresholdPct: number,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  const diagnostics = {
    studentsSent: 0,
    studentsSkipped: candidates.length,
    refsDropped: 0,
    payloadHadNames: false,
  };

  if (!deps.provider || !deps.provider.isConfigured()) {
    return { ok: false, code: "ai_not_configured", prepared: [], diagnostics };
  }

  const { signals, byRef } = prepareSignals(candidates, dropThresholdPct);
  if (signals.length === 0) {
    return { ok: true, prepared: [], diagnostics: { ...diagnostics, studentsSkipped: candidates.length } };
  }

  const envelope: AlertsInputEnvelope = {
    locale,
    students: signals.map((s) => ({
      ref: s.ref,
      gradeLevel: s.gradeLevel,
      signals: s.signals
        .filter(isNotable)
        .map((x: SubjectSignal) => ({
          subject: x.subject,
          recentAveragePct: x.recentAveragePct,
          baselineAveragePct: x.baselineAveragePct,
          deltaPct: x.deltaPct,
          gradesConsidered: x.gradesConsidered,
          missingCount: x.missingCount,
          lateCount: x.lateCount,
          trend: x.trend,
        })),
    })),
  };

  const user = buildAlertsUserMessage(envelope);
  if (payloadContainsNames(user, names)) {
    // Refuse to transmit. This is a hard stop, not a warning.
    return {
      ok: false,
      code: "failed",
      prepared: [],
      diagnostics: { ...diagnostics, payloadHadNames: true },
    };
  }

  const result = await deps.provider.generate({
    system: STUDENT_ALERTS_SYSTEM_PROMPT,
    user,
    json: true,
    maxOutputTokens: 2000,
  });
  deps.onRun?.({
    promptVersion: STUDENT_ALERTS_PROMPT_VERSION,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(result.text);
  } catch {
    return { ok: false, code: "ai_output_invalid", prepared: [], diagnostics: { ...diagnostics, studentsSent: signals.length } };
  }

  const parsed = alertsModelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "ai_output_invalid", prepared: [], diagnostics: { ...diagnostics, studentsSent: signals.length } };
  }

  const prepared: PreparedAlert[] = [];
  let dropped = 0;

  for (const item of parsed.data.alerts) {
    const candidate = byRef.get(item.ref);
    if (!candidate) {
      // The model invented a ref, or referred to a student we never sent.
      dropped += 1;
      continue;
    }

    const matching = signals.find((s) => s.ref === item.ref);
    const subject = matching?.signals.find((s) => item.evidence?.includes(s.subject)) ?? matching?.signals[0];
    const assessmentCount = subject?.gradesConsidered ?? 0;

    prepared.push({
      studentId: candidate.id,
      alertType: item.alertType,
      severity: item.severity,
      message: item.message,
      suggestedAction: item.suggestedAction ?? null,
      evidence: item.evidence ?? null,
      assessmentCount,
      dedupeKey: subject ? buildDedupeKey(subject) : `${item.alertType}:general`,
      promptVersion: STUDENT_ALERTS_PROMPT_VERSION,
    });
  }

  return {
    ok: true,
    prepared,
    diagnostics: {
      studentsSent: signals.length,
      studentsSkipped: candidates.length - signals.length,
      refsDropped: dropped,
      payloadHadNames: false,
    },
  };
}
