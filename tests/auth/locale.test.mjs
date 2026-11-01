/**
 * Locale choice for the bare domain.
 *
 * `/` is the one route whose wrong answer is invisible: it redirects to a valid
 * page either way, so only a test notices that an English browser was sent to
 * Arabic.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, isLocale, pickLocale } from "../../build-test/locale.mjs";

test("English is chosen when English is the first preference", () => {
  assert.equal(pickLocale("en"), "en");
  assert.equal(pickLocale("en-GB,en;q=0.9"), "en");
  assert.equal(pickLocale("EN-us"), "en");
});

test("Arabic is the default for anything else", () => {
  assert.equal(pickLocale("ar-BH,ar;q=0.9"), "ar");
  assert.equal(pickLocale("fr-FR,fr;q=0.9"), DEFAULT_LOCALE);
  // Arabic listed first still wins even if English follows it.
  assert.equal(pickLocale("ar,en;q=0.8"), "ar");
});

test("a missing or malformed header falls back to the default", () => {
  assert.equal(pickLocale(undefined), "ar");
  assert.equal(pickLocale(null), "ar");
  assert.equal(pickLocale(""), "ar");
  assert.equal(pickLocale(",,,"), "ar");
});

test("isLocale accepts only the supported languages", () => {
  assert.equal(isLocale("ar"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(""), false);
  assert.equal(isLocale(undefined), false);
});