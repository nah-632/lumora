/**
 * evidenceSentence — the human form of the stored claim.
 *
 * "Based on N assessments" says how many. This says which, and what they showed:
 * "Math, assessments #3-5: 58.3%". It is built from the same rows as
 * evidence_ids, so the sentence and the stored ids cannot drift apart, and the
 * function is pure — a test can re-run it on the same fixture.
 *
 * Returns null when there is nothing to state; the UI then shows no line.
 */
import type { SubjectSignal, SignalEvidence } from "@/features/students/lib/signals";

export function evidenceSentence(
  signal: SubjectSignal,
  evidence: SignalEvidence | null,
  role: "baseline" | "recent" | "missing",
  locale: "ar" | "en",
): string | null {
  if (!evidence) return null;

  if (role === "missing") {
    const n = evidence.missing.length;
    if (n === 0) return null;
    return locale === "ar"
      ? `${signal.subject}: ${n} واجبات غير مسلّمة`
      : `${signal.subject}: ${n} missing submission${n === 1 ? "" : "s"}`;
  }

  const rows = role === "baseline" ? evidence.baseline : evidence.recent;
  if (rows.length === 0) return null;

  const first = rows[0].ordinal;
  const last = rows[rows.length - 1].ordinal;
  const span = first === last ? `#${first}` : `#${first}-#${last}`;
  const average = role === "baseline" ? evidence.baselineAveragePct : evidence.recentAveragePct;

  return locale === "ar"
    ? `${signal.subject}، التقييمات ${span}: ${average ?? "-"}%`
    : `${signal.subject}, assessments ${span}: ${average ?? "-"}%`;
}
