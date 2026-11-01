/**
 * The auth callback's two rules, tested as pure functions.
 *
 * `next` is attacker-controlled in every flow that carries one, and a redirect
 * that trusts it is a phishing vector on the domain the teacher just logged in
 * to. A browser treats `//host` and `/\host` as protocol-relative, so "starts
 * with a slash" is not a sufficient test — these cases exist to keep that
 * distinction from being quietly relaxed.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  callbackUrl,
  localeFromNext,
  safeNext,
} from "../../build-test/auth-redirect.mjs";

test("safeNext keeps a same-site absolute path", () => {
  assert.equal(safeNext("/ar/students"), "/ar/students");
  assert.equal(safeNext("/en/tools?x=1"), "/en/tools?x=1");
});

test("safeNext rejects an absolute URL", () => {
  assert.equal(safeNext("https://evil.example/path"), "/ar/students");
});

test("safeNext rejects protocol-relative targets", () => {
  assert.equal(safeNext("//evil.example"), "/ar/students");
  // Browsers normalise a backslash to a slash, so this is the same attack.
  assert.equal(safeNext("/\\evil.example"), "/ar/students");
});

test("safeNext rejects control characters", () => {
  assert.equal(safeNext("/ar/students\nLocation: https://evil.example"), "/ar/students");
  assert.equal(safeNext("/ar/\u0000students"), "/ar/students");
});

test("safeNext falls back to the requested locale", () => {
  assert.equal(safeNext(undefined, "en"), "/en/students");
  assert.equal(safeNext("", "en"), "/en/students");
});

test("localeFromNext reads the language the teacher was using", () => {
  assert.equal(localeFromNext("/en/tools"), "en");
  assert.equal(localeFromNext("/en"), "en");
  assert.equal(localeFromNext("/ar/students"), "ar");
  // Not a locale prefix, just a path beginning with those letters.
  assert.equal(localeFromNext("/english"), "ar");
  assert.equal(localeFromNext(null), "ar");
});

test("callbackUrl builds an absolute, encoded target", () => {
  assert.equal(
    callbackUrl("https://lumora.example", "/ar/students"),
    "https://lumora.example/auth/callback?next=%2Far%2Fstudents",
  );
  assert.equal(callbackUrl("https://lumora.example/"), "https://lumora.example/auth/callback");
});

test("callbackUrl does not double the slash on an origin with a trailing one", () => {
  assert.equal(
    callbackUrl("https://lumora.example///", "/en/tools"),
    "https://lumora.example/auth/callback?next=%2Fen%2Ftools",
  );
});