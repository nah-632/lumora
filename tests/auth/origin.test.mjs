/**
 * The auth-origin allow-list.
 *
 * This is the control that stops a forged `Host` header from producing an email
 * whose link points at someone else's domain — with a real recovery code in it.
 * The tests below are written from the attacker's side: every one of them is a
 * value an attacker actually controls.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseOrigin,
  parseOriginList,
  resolveAuthOrigin,
} from "../../build-test/auth-origin.mjs";

const ALLOWED = "https://lumora.example,https://pr-22.lumora-preview.vercel.app";
const SITE = "https://lumora.example";

test("a spoofed Host never becomes the redirect origin", () => {
  // The classic: attacker-controlled Host naming their own domain.
  const resolved = resolveAuthOrigin({
    requestOrigin: "https://evil.test",
    siteUrl: SITE,
    allowed: ALLOWED,
  });
  assert.equal(resolved, SITE);
  assert.ok(!String(resolved).includes("evil"));
});

test("a look-alike host is rejected", () => {
  const resolved = resolveAuthOrigin({
    requestOrigin: "https://lumora.example.evil.test",
    siteUrl: SITE,
    allowed: ALLOWED,
  });
  assert.equal(resolved, SITE);
});

test("an allow-listed preview origin is accepted", () => {
  assert.equal(
    resolveAuthOrigin({
      requestOrigin: "https://pr-22.lumora-preview.vercel.app",
      siteUrl: SITE,
      allowed: ALLOWED,
    }),
    "https://pr-22.lumora-preview.vercel.app",
  );
});

test("scheme and case do not defeat the match, but a different scheme does", () => {
  assert.equal(
    resolveAuthOrigin({
      requestOrigin: "HTTPS://Lumora.Example/",
      siteUrl: null,
      allowed: ALLOWED,
    }),
    "https://lumora.example",
  );
  // http is not https even for the same host.
  assert.equal(
    resolveAuthOrigin({ requestOrigin: "http://lumora.example", siteUrl: SITE, allowed: ALLOWED }),
    SITE,
  );
});

test("with no allow-list the claim is ignored entirely", () => {
  assert.equal(
    resolveAuthOrigin({ requestOrigin: "https://evil.test", siteUrl: SITE, allowed: "" }),
    SITE,
  );
});

test("with neither an allow-list nor a site URL there is no origin", () => {
  assert.equal(resolveAuthOrigin({ requestOrigin: "https://evil.test" }), null);
});

test("the first listed origin is the last resort", () => {
  assert.equal(
    resolveAuthOrigin({ requestOrigin: "https://evil.test", allowed: ALLOWED, siteUrl: null }),
    "https://lumora.example",
  );
});

test("normaliseOrigin rejects anything that is not http(s) with a host", () => {
  assert.equal(normaliseOrigin("javascript:alert(1)"), null);
  assert.equal(normaliseOrigin("data:text/html,x"), null);
  assert.equal(normaliseOrigin("not a url"), null);
  assert.equal(normaliseOrigin(""), null);
  assert.equal(normaliseOrigin(undefined), null);
  assert.equal(normaliseOrigin("https://lumora.example/path?q=1"), "https://lumora.example");
});

test("parseOriginList drops junk instead of failing the whole list", () => {
  assert.deepEqual(parseOriginList("https://a.example, ,not-a-url,https://b.example"), [
    "https://a.example",
    "https://b.example",
  ]);
  assert.deepEqual(parseOriginList(""), []);
  assert.deepEqual(parseOriginList(undefined), []);
});