import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/auth/server";

/**
 * One student's detail: grades, submissions, interventions and alerts.
 *
 * The caller's session is used throughout, so RLS decides whether this student
 * is visible. A guessed id belonging to another teacher returns 404, not 403,
 * so the response does not confirm that the record exists.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 404 });
  }

  const [grades, submissions, interventions, alerts] = await Promise.all([
    supabase.from("student_grades")
      .select("id, subject, assessment_name, score, max_score, date")
      .eq("student_id", id).order("date", { ascending: false }),
    supabase.from("student_submissions")
      .select("id, project_name, status, date")
      .eq("student_id", id).order("date", { ascending: false }),
    supabase.from("student_interventions")
      .select("id, action, subject, occurred_on")
      .eq("student_id", id).order("occurred_on", { ascending: false }),
    supabase.from("student_alerts")
      .select("id, alert_type, severity, message, suggested_action, evidence, assessment_count, basis_kind, basis_count, evidence_ids, is_read, snoozed_until, dismissed_at, created_at")
      .eq("student_id", id).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      grades: grades.data ?? [],
      submissions: submissions.data ?? [],
      interventions: interventions.data ?? [],
      alerts: (alerts.data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        alertType: a.alert_type,
        severity: a.severity,
        message: a.message,
        suggestedAction: a.suggested_action,
        evidence: a.evidence,
        assessmentCount: a.assessment_count,
        // kind and count travel together; the UI renders a sentence only when
        // both are present, so the line can never mislabel its own number.
        basisKind: a.basis_kind,
        basisCount: a.basis_count,
        evidenceIds: a.evidence_ids,
        isRead: a.is_read,
        snoozedUntil: a.snoozed_until,
        dismissed: a.dismissed_at !== null,
        createdAt: a.created_at,
      })),
    },
  });
}
