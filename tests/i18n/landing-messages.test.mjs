import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Catalogue and navigation integrity for the landing page.
 *
 * Three failures this catches, all of which render as something that looks
 * deliberate on screen rather than as an error:
 *
 *   1. a key that exists in one language and not the other — next-intl renders
 *      the key PATH instead of throwing, so the page shows "landing.chips.x";
 *   2. a key the components ask for that no catalogue defines — same symptom;
 *   3. a navigation item pointing at an id the page does not have — the link
 *      silently does nothing, which reads as a broken page.
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const MESSAGES = path.join(ROOT, "messages");
const LANDING_COMPONENTS = [
  "src/components/landing/LandingHero.tsx",
  "src/components/landing/SiteHeader.tsx",
];
const PAGE = "src/app/[locale]/page.tsx";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const catalog = (locale) =>
  JSON.parse(fs.readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8"));

function keyPaths(node, prefix = "") {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return [prefix];
  return Object.entries(node).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

test("the landing namespace defines exactly the same keys in both languages", () => {
  const ar = keyPaths(catalog("ar").landing).sort();
  const en = keyPaths(catalog("en").landing).sort();
  const onlyAr = ar.filter((k) => !en.includes(k));
  const onlyEn = en.filter((k) => !ar.includes(k));
  assert.deepEqual(onlyAr, [], `missing from en: ${onlyAr.join(", ")}`);
  assert.deepEqual(onlyEn, [], `missing from ar: ${onlyEn.join(", ")}`);
});

test("the whole catalogue is key-for-key identical across languages", () => {
  const ar = keyPaths(catalog("ar")).sort();
  const en = keyPaths(catalog("en")).sort();
  assert.deepEqual(
    ar.filter((k) => !en.includes(k)),
    [],
    "keys present in ar but not en",
  );
  assert.deepEqual(
    en.filter((k) => !ar.includes(k)),
    [],
    "keys present in en but not ar",
  );
});

test("every message key the landing components ask for exists", () => {
  const ar = new Set(keyPaths(catalog("ar").landing));
  const en = new Set(keyPaths(catalog("en").landing));

  const literal = new Set();
  noChevron: {
    for (const rel of LANDING_COMPONENTS) {
      const src = read(rel);
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) literal.add(m[1]);
    }
  }

  // Keys the components compose from data rather than writing out.
  const dynamic = new Set();
  for (const card of ["lessonPlan", "questions", "remedial", "students"]) {
    dynamic.add(`cards.${card}.title`);
    dynamic.add(`cards.${card}.body`);
  }
  for (const cta of ["tryTool", "open"]) dynamic.add(`cta.${cta}`);
  for (const item of ["bilingual", "tap", "review", "stage"]) {
    dynamic.add(`strip.${item}.title`);
    dynamic.add(`strip.${item}.body`);
  }

  const used = [...literal, ...dynamic].sort();
  assert.ok(used.length >= 20, `expected a real key set, found ${used.length}`);
  for (const key of used) {
    assert.ok(ar.has(key), `messages/ar.json is missing landing.${key}`);
    assert.ok(en.has(key), `messages/en.json is missing landing.${key}`);
  }
});

test("every navigation target is an id that exists on the page", () => {
  const header = read("src/components/landing/SiteHeader.tsx");
  const targets = [...header.matchAll(/href="(#[^"]+)"/g)].map((m) => m[1].slice(1));
  assert.ok(targets.length > 0, "the header has no in-page navigation");

  const pageSource =
    read(PAGE) + LANDING_COMPONENTS.map(read).join("\n") + read("src/components/landing/Sections.tsx");
  const ids = new Set([...pageSource.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

  for (const target of targets) {
    assert.ok(ids.has(target), `the nav points at #${target}, which the page does not define`);
  }
  assert.deepEqual(
    [...new Set(targets)].sort(),
    ["benefits", "tools-row"],
    "the nav should carry exactly the two sections that exist",
  );
});

test("the navigation labels come from the catalogue, not from literals", () => {
  const header = read("src/components/landing/SiteHeader.tsx");
  for (const locale of ["ar", "en"]) {
    const landing = catalog(locale).landing;
    assert.match(header, new RegExp(`t\\("nav\\.tools"\\)`));
    assert.match(header, new RegExp(`t\\("nav\\.benefits"\\)`));
    assert.ok(landing.nav.tools && landing.nav.benefits);
  }
  // A chevron in the nav would promise a dropdown that does not exist.
  const nav = header.slice(header.indexOf("<nav"), header.indexOf("</nav>"));
  assert.doesNotMatch(nav, /polyline|chevron/i, "the nav carries a dropdown chevron");
});
