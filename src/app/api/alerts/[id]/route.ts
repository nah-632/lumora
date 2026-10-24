import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/auth/server";

/**
 * Mark read / snooze / dismiss an alert.
 *
 * Only the four mutable columns are ever sent, matching the column-level grant
 * on student_alerts. The alert's own text is never writable, so the AI evidence
 * trail cannot be rewritten by a client.
 */
const bodySchema = z.object({
  action: z.enum(["mark_read", "snooze", "dismiss"]),
  until: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.action === "mark_read") {
    patch.is_read = true;
  } else if (parsed.data.action === "snooze") {
    // Default snooze is one week when the client does not specify a date.
    const until = parsed.data.until ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    patch.snoozed_until = until.toISOString();
  } else {
    if (!parsed.data.reason) {
      return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
    }
    patch.dismissed_at = new Date().toISOString();
    patch.dismissed_reason = parsed.data.reason;
    patch.is_read = true;
  }

  const supabase = await createSessionClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });

  const { data, error } = await supabase
    .from("student_alerts")
    .update(patch)
    .eq("id", id)
    .select("id");

  // Zero rows means RLS filtered it out: the alert is not the caller's.
  if (error || !data || data.length === 0) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { id } });
}
