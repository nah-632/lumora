import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/auth/server";

const bodySchema = z.object({
  dropThresholdPct: z.coerce.number().int().min(1).max(100),
  missingWorkAlerts: z.boolean().optional(),
});

/** Upsert the caller's own alert settings. teacher_id is never taken from input. */
export async function PUT(req: Request) {
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

  const supabase = await createSessionClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("teacher_alert_settings")
    .upsert(
      {
        teacher_id: userData.user.id,
        drop_threshold_pct: parsed.data.dropThresholdPct,
        ...(parsed.data.missingWorkAlerts === undefined
          ? {}
          : { missing_work_alerts: parsed.data.missingWorkAlerts }),
      },
      { onConflict: "teacher_id" },
    );

  if (error) return NextResponse.json({ ok: false, code: "failed" }, { status: 400 });
  return NextResponse.json({ ok: true, data: { dropThresholdPct: parsed.data.dropThresholdPct } });
}
