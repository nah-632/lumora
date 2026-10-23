import { q, closePool } from "../data-access/db.mjs";
import { assertTransition, IllegalTransitionError } from "../domain/booking-state-machine.mjs";
import crypto from "node:crypto";

function genRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return "SRV-" + s;
}

export async function createBooking(draft, actor = "customer") {
  const ref = genRef();
  const key = draft.idempotencyKey;
  const { rows } = await q(
    `INSERT INTO bookings
       (reference, service_id, governorate, area, address_details,
        preferred_date, preferred_slot, service_details,
        contact_name, contact_phone, customer_phone, idempotency_key, state, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,'pending_confirmation',$12)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, reference, state`,
    [ref, draft.serviceId, draft.governorate, draft.area, draft.addressDetails,
     draft.preferredDate, draft.preferredSlot, JSON.stringify(draft.serviceDetails ?? {}),
     draft.contactName, draft.contactPhone, key, draft.notes ?? null]
  );
  if (rows.length === 0) {
    const dup = await q(
      `SELECT id, reference, state FROM bookings WHERE idempotency_key = $1`, [key]
    );
    if (dup.rows[0]) return dup.rows[0];
    throw new Error("idempotency key conflict without existing row");
  }
  const booking = rows[0];
  await q(
    `INSERT INTO booking_status_history (booking_id, to_state, actor_role, reason)
     VALUES ($1, 'pending_confirmation', $2, 'created')`,
    [booking.id, actor]
  );
  await q(
    `INSERT INTO audit_logs (actor_role, action, entity, entity_id, after_val)
     VALUES ($1, 'booking.create', 'booking', $2, $3)`,
    [actor, booking.id, JSON.stringify({ reference: booking.reference })]
  );
  return { ...booking, state: "pending_confirmation" };
}

export async function transitionBooking(bookingId, to, actor, reason = "") {
  const b = (await q(`SELECT id, state FROM bookings WHERE id = $1`, [bookingId])).rows[0];
  if (!b) throw new Error(`Booking not found: ${bookingId}`);
  assertTransition(b.state, to, actor);
  await q(`UPDATE bookings SET state = $2, updated_at = now() WHERE id = $1`, [bookingId, to]);
  await q(
    `INSERT INTO booking_status_history (booking_id, from_state, to_state, actor_role, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, b.state, to, actor, reason]
  );
  await q(
    `INSERT INTO audit_logs (actor_role, action, entity, entity_id, before_val, after_val)
     VALUES ($1, 'booking.transition', 'booking', $2, $3, $4)`,
    [actor, bookingId, JSON.stringify({ state: b.state }), JSON.stringify({ state: to })]
  );
  return { id: bookingId, state: to };
}

export async function trackBooking(reference, phoneLast4) {
  const row = (await q(
    `SELECT b.state, s.name_ar, b.preferred_date, b.preferred_slot
       FROM bookings b JOIN services s ON s.id = b.service_id
      WHERE b.reference = $1 AND RIGHT(b.customer_phone, 4) = $2`,
    [reference, phoneLast4]
  )).rows[0];
  if (!row) return null;
  return { reference, state: row.state, service: row.name_ar, date: row.preferred_date, slot: row.preferred_slot };
}

export { closePool };
