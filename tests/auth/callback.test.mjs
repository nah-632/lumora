/**
 * /auth/callback, with the Supabase client replaced by a fake.
 *
 * What is being proved is the shape that makes an email link actually work: the
 * exchange's session cookies come back TOGETHER with the redirect target, so the
 * route can put them on the same response. A callback that redirects without the
 * cookie is the "the link does nothing" bug.
 *
 * What this does NOT prove: that Supabase really returns those cookies for a
 * real link. That needs a live project and a delivered email, which is not
 * available here — see the note at the end of the file.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { completeCallback } from "../../build-test/auth-callback.mjs";

const SESSION_COOKIE = {
  name: "sb-test-auth-token",
  value: "base64-session",
  options: { path: "/", httpOnly: true, sameSite: "lax" },
};

function fakeExchange({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    exchange: async (code, sink) => {
      calls.push(code);
      if (fail) return { error: { message: "invalid flow state" } };
      sink([SESSION_COOKIE]);
      return { error: null };
    },
  };
}

test("a valid code sets the session cookie and lands on next", async () => {
  const fake = fakeExchange();
  const outcome = await completeCallback({
    code: "good-code",
    next: "/en/tools",
    exchange: fake.exchange,
  });

  assert.equal(outcome.nextPath, "/en/tools");
  assert.equal(outcome.expired, false);
  // The cookie travels with the target — this is the property the route relies
  // on to put it on the redirect response itself.
  assert.equal(outcome.cookies.length, 1);
  assert.equal(outcome.cookies[0].name, SESSION_COOKIE.name);
  assert.equal(outcome.cookies[0].value, SESSION_COOKIE.value);
  assert.deepEqual(outcome.cookies[0].options, SESSION_COOKIE.options);
  assert.deepEqual(fake.calls, ["good-code"]);
});

test("an open-redirect attempt in next falls back to the dashboard", async () => {
  for (const hostile of [
    "//evil.test/steal",
    "/\\evil.test",
    "https://evil.test",
    "javascript:alert(1)",
  ]) {
    const outcome = await completeCallback({
      code: "good-code",
      next: hostile,
      exchange: fakeExchange().exchange,
    });
    assert.equal(outcome.nextPath, "/ar/students", `next=${JSON.stringify(hostile)}`);
    assert.ok(!outcome.nextPath.includes("evil"));
  }
});

test("a hostile next does not stop the session being established", async () => {
  const outcome = await completeCallback({
    code: "good-code",
    next: "//evil.test",
    exchange: fakeExchange().exchange,
  });
  assert.equal(outcome.cookies.length, 1, "the exchange still ran and issued a cookie");
});

test("a failed exchange yields no cookies and an expired notice", async () => {
  const outcome = await completeCallback({
    code: "stale-code",
    next: "/ar/tools",
    exchange: fakeExchange({ fail: true }).exchange,
  });

  assert.equal(outcome.expired, true);
  assert.equal(outcome.nextPath, "/ar/sign-in?expired=1");
  assert.deepEqual(outcome.cookies, [], "a failed exchange must not set a session");
});

test("no code means no exchange at all", async () => {
  let called = false;
  const outcome = await completeCallback({
    code: null,
    next: null,
    exchange: async () => {
      called = true;
      return { error: null };
    },
  });

  assert.equal(called, false);
  assert.equal(outcome.nextPath, "/ar/sign-in");
  assert.equal(outcome.expired, false);
});

test("the locale of a failed redirect follows the requested next", async () => {
  const outcome = await completeCallback({
    code: "stale",
    next: "/en/tools",
    exchange: fakeExchange({ fail: true }).exchange,
  });
  assert.equal(outcome.nextPath, "/en/sign-in?expired=1");
});

/*
 * NOT PROVEN HERE, deliberately stated rather than implied:
 *   - that a real Supabase project issues these cookies for a real link;
 *   - that the browser stores them from the redirect (verified only by reading
 *     the route: it calls response.cookies.set on the redirect object);
 *   - that the PKCE verifier cookie written at sign-up is present and valid.
 * An end-to-end check needs a delivered email and a live project.
 */