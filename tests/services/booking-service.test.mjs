import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { q, closePool } from "../../src/data-access/db.mjs";
import {
  createBooking,
  transitionBooking,
  trackBooking,
} from "../../src/services/booking-service.mjs";

// Get a valid service + subservice
const svc = (await q(
  `SELECT s.id, s.name_ar FROM services s WHERE s.is_active = TRUE LIMIT 1`
)).rows[0];

if (!svc) {
  // Seed one if schema has no services yet
  await q(`INSERT INTO services (category_id, name_ar, name_en)
           SELECT id, 'كشف تكييف','AC Inspection' FROM service_categories LIMIT 1
           ON CONFLICT DO NOTHING`);
}
const { rows: [row] } = await q(`SELECT id FROM services LIMIT 1`);
const serviceId = row.id;

const phone = "+97312345678";

// CREATE
const created = await createBooking({
  serviceId,
  governorate: "capital",
  area: "Manama",
  addressDetails: "Block 3, Villa 12",
  preferredDate: "2026-10-30",
  preferredSlot: "09:00",
  serviceDetails: { unitType: "split", count: 2 },
  contactName: "Test Customer",
  contactPhone: phone,
  idempotencyKey: "test-key-" + Date.now(),
});
assert.ok(created.id, "booking created with id");
assert.equal(created.state, "pending_confirmation");
assert.match(created.reference, /^SRV-/);

// IDMPOTENT REPLAY — same key returns same booking, no new row
const replay = await createBooking({ ...created && {
  serviceId, governorate:"capital", area:"Manama", addressDetails:"Block 3, Villa 12",
  preferredDate:"2026-10-30", preferredSlot:"09:00", contactName:"Test Customer",
  contactPhone: phone, idempotencyKey: created.idempotencyKey ?? "test-key-1"
}});

// TRANSITION: admin confirms
const confirmed = await transitionBooking(created.id, "confirmed", "admin");
assert.equal(confirmed.state, "confirmed");

// TRANSITION: operations assigns
const assigned = await transitionBooking(created.id, "assigned", "operations");
assert.equal(assigned.state, "assigned");

// ILLEGAL: customer cannot assign
assert.rejects(
  transitionBooking(created.id, "assigned", "customer"),
  (err) => err.name === "IllegalTransitionError"
);

// TRACK: reference + phone last-4
const tracked = await trackBooking(created.reference, "5678");
assert.equal(tracked.state, "assigned");
assert.equal(tracked.service, "كشف تكييف");

// ILLEGAL TRACK: wrong last-4 returns null
assert.equal(await trackBooking(created.reference, "0000"), null);

console.log(`booking-service: 9 assertions passed — booking ${created.reference}`);
await closePool();
