import assert from "node:assert/strict";
import {
  canTransition,
  assertTransition,
  IllegalTransitionError,
  ACTIVE_STATES,
} from "../../src/domain/booking-state-machine.mjs";

// happy path
assert.ok(canTransition("draft", "pending_confirmation", "customer"));
assert.ok(canTransition("pending_confirmation", "confirmed", "admin"));
assert.ok(canTransition("confirmed", "assigned", "operations"));
assert.ok(canTransition("assigned", "technician_en_route", "provider"));
assert.ok(canTransition("technician_en_route", "in_progress", "provider"));
assert.ok(canTransition("in_progress", "completed", "provider"));

// cancellation windows
assert.ok(canTransition("pending_confirmation", "cancelled", "customer"));
assert.ok(canTransition("confirmed", "cancelled", "customer"));
assert.equal(canTransition("assigned", "cancelled", "customer"), false, "customer cannot cancel after assignment");

// illegal transitions
assert.throws(() => assertTransition("pending_confirmation", "confirmed", "provider"), IllegalTransitionError);
assert.throws(() => assertTransition("in_progress", "completed", "customer"), IllegalTransitionError);
assert.equal(canTransition("completed", "cancelled", "admin"), false, "no exit from terminal");
assert.equal(canTransition("draft", "confirmed", "customer"), false, "cannot skip states");

// active states
assert.ok(!ACTIVE_STATES.includes("completed"));
assert.ok(!ACTIVE_STATES.includes("cancelled"));

console.log("state-machine: 14 assertions passed");
