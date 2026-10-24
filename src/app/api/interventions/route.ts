import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/auth/server";
import { interventionCreateSchema } from "@/features/students/schemas";

/** Log what the teacher actually did. Teacher-authored only, never AI-written. */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const parsed = interventionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });

  // teacher_id is omitted deliberately: it defaults to auth.uid() and the INSERT
  // policy requires it to equal the caller.
  const { data, error } = await supabase
    .from("student_interventions")
    .insert({
      student_id: parsed.data.studentId,
      action: parsed.data.action,
      subject: parsed.data.subject ?? null,
      alert_id: parsed.data.alertId ?? null,
    })
    .select("id, action, subject, occurred_on")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
