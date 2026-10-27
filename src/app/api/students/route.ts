import { NextResponse } from "next/server";
import { studentCreateSchema } from "@/features/students/schemas";
import { readSupabaseEnv, requireUser, restRequest } from "@/server/supabase";

/**
 * Creating a student runs with the caller's own access token, so teacher_id is
 * enforced by the database. The server never supplies teacher_id from user input.
 *
 * The caller is resolved from the real session (@supabase/ssr + getUser), so an
 * anonymous request is refused here instead of failing later inside the fetch.
 */
export async function POST(req: Request) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const parsed = studentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  const env = readSupabaseEnv();
  if (!env) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });
  }

  const res = await restRequest(env, session.token, "students", {
    method: "POST",
    headers: { prefer: "return=representation" },
    // teacher_id is deliberately omitted: it defaults to auth.uid() in the
    // database, and the INSERT policy requires it to equal the caller. Sending
    // it from the client would be redundant and is never trusted.
    body: JSON.stringify({
      name: parsed.data.name,
      grade_level: parsed.data.gradeLevel,
      class_label: parsed.data.classLabel || null,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 400 });
  }

  const row = Array.isArray(res.data) ? (res.data[0] as Record<string, unknown>) : null;
  if (!row) {
    return NextResponse.json({ ok: false, code: "failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: row.id,
      name: row.name,
      gradeLevel: row.grade_level,
      classLabel: row.class_label,
    },
  });
}