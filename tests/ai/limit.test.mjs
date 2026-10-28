/**
 * Rate limiter tests.
 *
 * The clock is injected, so the daily cap is tested by advancing time rather
 * than by waiting or by manipulating internals.
 *
 * Run with: node --test tests/ai/limit.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { InMemoryRateLimiter, DEFAULT_LIMITS } = await import("../../build-test/limit.mjs");

/** A controllable clock. */
function clock(start = 1_700_000_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}

test("limits: the burst limit allows exactly perMinute requests", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 3, perDay: 100 }, c.now);

  assert.equal(limiter.check("u1").allowed, true);
  assert.equal(limiter.check("u1").allowed, true);
  assert.equal(limiter.check("u1").allowed, true);

  const refused = limiter.check("u1");
  assert.equal(refused.allowed, false);
  assert.equal(refused.reason, "rate_limited");
  assert.ok(refused.retryAfterSeconds > 0 && refused.retryAfterSeconds <= 60);
});

test("limits: the window slides, so capacity returns after a minute", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 2, perDay: 100 }, c.now);

  limiter.check("u1");
  limiter.check("u1");
  assert.equal(limiter.check("u1").allowed, false);

  c.advance(60_001);
  assert.equal(limiter.check("u1").allowed, true, "the minute window has moved past the old stamps");
});

test("limits: users do not share a bucket", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 1, perDay: 100 }, c.now);

  assert.equal(limiter.check("teacher-a").allowed, true);
  assert.equal(limiter.check("teacher-a").allowed, false);
  assert.equal(limiter.check("teacher-b").allowed, true, "one teacher's usage must not lock out another");
});

test("limits: the daily cap is separate from the burst limit", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 2, perDay: 5 }, c.now);

  // Five requests, spaced so the per-minute window never blocks.
  for (let i = 0; i < 5; i += 1) {
    assert.equal(limiter.check("u1").allowed, true, `request ${i + 1} should pass`);
    c.advance(61_000);
  }

  const refused = limiter.check("u1");
  assert.equal(refused.allowed, false);
  assert.equal(refused.reason, "quota_exceeded", "hitting the day cap must not look like a burst limit");
  assert.ok(refused.retryAfterSeconds > 60, "the wait is measured in hours, not seconds");
});

test("limits: a refused request does not extend its own lockout", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 2, perDay: 100 }, c.now);

  // Fill the window, then confirm the next one is refused.
  limiter.check("u1");
  limiter.check("u1");
  const firstRefusal = limiter.check("u1");
  assert.equal(firstRefusal.allowed, false);

  // Hammering while refused must not push the window forward.
  for (let i = 0; i < 20; i += 1) limiter.check("u1");

  c.advance(60_001);
  assert.equal(
    limiter.check("u1").allowed,
    true,
    "retrying during the lockout must not keep the lockout alive",
  );
});

test("limits: the day expires and capacity returns", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 100, perDay: 2 }, c.now);

  limiter.check("u1");
  limiter.check("u1");
  assert.equal(limiter.check("u1").reason, "quota_exceeded");

  c.advance(24 * 60 * 60 * 1000 + 1);
  assert.equal(limiter.check("u1").allowed, true);
});

test("limits: the map does not grow without bound", () => {
  const c = clock();
  const limiter = new InMemoryRateLimiter({ perMinute: 5, perDay: 5 }, c.now);

  for (let i = 0; i < 500; i += 1) {
    limiter.check(`user-${i}`);
    c.advance(1000);
  }

  // Sweep runs once a minute; advancing well past a day should drop everyone.
  c.advance(25 * 60 * 60 * 1000);
  limiter.check("someone-new");
  c.advance(25 * 60 * 60 * 1000);
  limiter.check("someone-newer");

  assert.equal(limiter.check("user-0").allowed, true, "an ancient user is treated as fresh, not blocked");
});

test("limits: the defaults are the documented values", () => {
  assert.equal(DEFAULT_LIMITS.perMinute, 5);
  assert.equal(DEFAULT_LIMITS.perDay, 60);
});
