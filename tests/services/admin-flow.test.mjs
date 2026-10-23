import assert from "node:assert/strict";
import { q, closePool } from "../../src/data-access/db.mjs";
import { createBooking, transitionBooking } from "../../src/services/booking-service.mjs";

const { rows: [svc] } = await q("SELECT id FROM services LIMIT 1");
assert.ok(svc, "service exists");

const created = await createBooking({
  serviceId: svc.id,
  governorate: "capital",
  area: "Manama",
  addressDetails: "V12",
  preferredDate: "2026-11-05",
  preferredSlot: "09:00",
  serviceDetails: { category: "ac" },
  contactName: "Admin Test",
  contactPhone: "+97399999999",
  idempotencyKey: "admin-flow-" + Date.now(),
});
assert.equal(created.state, "pending_confirmation");

// Full lifecycle
const r1 = await transitionBooking(created.id, "confirmed", "admin");
assert.equal(r1.state, "confirmed");
const r2 = await transitionBooking(created.id, "assigned", "operations");
assert.equal(r2.state, "assigned");
const r3 = await transitionBooking(created.id, "technician_en_route", "provider");
assert.equal(r3.state, "technician_en_route");
const r4 = await transitionBooking(created.id, "in_progress", "provider");
assert.equal(r4.state, "in_progress");
const r5 = await transitionBooking(created.id, "completed", "provider");
assert.equal(r5.state, "completed");

// Terminal: no exit from completed
await assert.rejects(
  transitionBooking(created.id, "cancelled", "admin"),
  (e) => e.name === "IllegalTransitionError",
  "no exit from terminal"
);

// history
const hist = (await q(
  `SELECT to_state FROM booking_status_history WHERE booking_id = $1 ORDER BY id`,
  [created.id]
)).rows;
assert.deepEqual(
  hist.map((h) => h.to_state),
  ["pending_confirmation","confirmed","assigned","technician_en_route","in_progress","completed"],
  "history sequence"
);

// audit entries exist
const { rows: audit } = await q(
  `SELECT COUNT(*)::int AS n FROM audit_logs WHERE entity_id = $1`,
  [created.id]
);
assert.ok(audit[0].n >= 5, `audit entries: ${audit[0].n}`);

console.log(`admin-flow: full lifecycle + audit + history OK — ${created.reference}`);
await closePool();
