/**
 * The password-update rules.
 *
 * Each test corresponds to a property that would be a real vulnerability if it
 * lived only in the UI: a Server Action is reachable without rendering the page.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyNewPassword,
  isAcceptablePassword,
} from "../../build-test/update-password.mjs";

/** Collects everything passed to console while a test runs. */
function captureConsole() {
  const original = { ...console };
  const seen = [];
  for (const level of ["log", "warn", "error", "info", "debug"]) {
    console[level] = (...args) => seen.push({ level, args });
  }
  return {
    seen,
    restore() {
      Object.assign(console, original);
    },
  };
}

const mapError = (m) => (String(m).includes("rate") ? "rate_limited" : "failed");

function harness({ session = true, updateFails = false } = {}) {
  const updates = [];
  return {
    updates,
    args: {
      rawPassword: "correct-horse-battery",
      getUser: async () => ({ user: session ? { id: "u1" } : null }),
      updateUser: async (password) => {
        updates.push(password);
        return { error: updateFails ? { message: "rate limit exceeded" } : null };
      },
      mapError,
    },
  };
}

test("a valid password with a session is accepted", async () => {
  const h = harness();
  const result = await applyNewPassword(h.args);
  assert.deepEqual(result, { ok: true });
  assert.equal(h.updates.length, 1);
});

test("no session is refused before the provider is called", async () => {
  const h = harness({ session: false });
  const result = await applyNewPassword(h.args);
  assert.deepEqual(result, { ok: false, code: "unauthorized" });
  assert.equal(h.updates.length, 0, "updateUser must not run for an anonymous caller");
});

test("the length rule is enforced server-side", async () => {
  for (const short of ["", "a", "1234567"]) {
    const h = harness();
    const result = await applyNewPassword({ ...h.args, rawPassword: short });
    assert.deepEqual(result, { ok: false, code: "invalid_input" });
    assert.equal(h.updates.length, 0);
  }
});

test("a non-string value is refused, not coerced", async () => {
  for (const raw of [null, undefined, 12345678, { password: "longenough" }]) {
    const h = harness();
    const result = await applyNewPassword({ ...h.args, rawPassword: raw });
    assert.deepEqual(result, { ok: false, code: "invalid_input" }, `raw=${String(raw)}`);
    assert.equal(h.updates.length, 0);
  }
});

test("an over-long password is refused", async () => {
  const h = harness();
  const result = await applyNewPassword({ ...h.args, rawPassword: "a".repeat(129) });
  assert.deepEqual(result, { ok: false, code: "invalid_input" });
});

test("a provider error becomes a code, never the provider message", async () => {
  const h = harness({ updateFails: true });
  const result = await applyNewPassword(h.args);
  assert.deepEqual(result, { ok: false, code: "rate_limited" });
  // The stable code is bilingual in the UI; the raw message never leaves here.
  assert.ok(!JSON.stringify(result).includes("rate limit exceeded"));
});

test("the password never appears in the result or in any console output", async () => {
  const capture = captureConsole();
  try {
    const ok = await applyNewPassword(harness().args);
    const bad = await applyNewPassword(harness({ updateFails: true }).args);
    assert.ok(!JSON.stringify(ok).includes("correct-horse-battery"));
    assert.ok(!JSON.stringify(bad).includes("correct-horse-battery"));
    for (const entry of capture.seen) {
      assert.ok(
        !JSON.stringify(entry.args).includes("correct-horse-battery"),
        `password reached console.${entry.level}`,
      );
    }
  } finally {
    capture.restore();
  }
});

test("the exported length rule matches what the tests assume", () => {
  assert.equal(isAcceptablePassword("12345678"), true);
  assert.equal(isAcceptablePassword("1234567"), false);
  assert.equal(isAcceptablePassword(12345678), false);
});