import { NextResponse } from "next/server";
import { q } from "@/data-access/db.mjs";
import { assertTransition } from "@/domain/booking-state-machine.mjs";

export const runtime = "nodejs";

// GET /api/admin/bookings?state=pending_confirmation
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  try {
    const { rows } = state
      ? await q(
          `SELECT b.id, b.reference, b.state, b.contact_name, b.contact_phone,
                  b.preferred_date, b.created_at, s.name_ar AS service_name
             FROM bookings b JOIN services s ON s.id = b.service_id
            WHERE b.state = $1 ORDER BY b.created_at DESC LIMIT 100`,
          [state]
        )
      : await q(
          `SELECT b.id, b.reference, b.state, b.contact_name, b.contact_phone,
                  b.preferred_date, b.created_at, s.name_ar AS service_name
             FROM bookings b JOIN services s ON s.id = b.service_id
            ORDER BY b.created_at DESC LIMIT 100`
        );
    return NextResponse.json({ bookings: rows });
  } catch (e) {
    console.error("[admin GET]", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}

// PATCH /api/admin/bookings  { id, to, actor }
export async function PATCH(req: Request) {
  try {
    const { id, to, actor } = await req.json();
    if (!id || !to || !actor) {
      return NextResponse.json({ error: "id, to, actor are required" }, { status: 400 });
    }
    const b = (await q(`SELECT state FROM bookings WHERE id = $1`, [id])).rows[0];
    if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    assertTransition(b.state as Parameters<typeof assertTransition>[0], to, actor as never);
    await q(`UPDATE bookings SET state = $2, updated_at = now() WHERE id = $1`, [id, to]);
    await q(
      `INSERT INTO booking_status_history (booking_id, from_state, to_state, actor_role, reason)
       VALUES ($1, $2, $3, $4, 'admin panel')`,
      [id, b.state, to, actor]
    );
    await q(
      `INSERT INTO audit_logs (actor_role, action, entity, entity_id, before_val, after_val)
       VALUES ($1, 'booking.transition', 'booking', $2, $3, $4)`,
      [actor, id, JSON.stringify({ state: b.state }), JSON.stringify({ state: to })]
    );
    return NextResponse.json({ ok: true, state: to });
  } catch (e) {
    if (e instanceof Error && e.name === "IllegalTransitionError") {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[admin PATCH]", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
