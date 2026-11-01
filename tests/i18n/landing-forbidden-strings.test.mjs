import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * The landing page may not claim things the product does not do.
 *
 * Every string below was on the reference mockup and had to come out: a
 * time-saving percentage, a Ministry affiliation, a curriculum-alignment claim,
 * a "most used" usage claim, a question bank that does not exist because nothing
 * is stored, a quality guarantee, and the whole pricing and "free" vocabulary.
 *
 * The check runs over the translation catalogues rather than the rendered page,
 * because that is where the strings live and a name in a catalogue is one edit
 * away from being shipped. It is deliberately a substring scan: a claim that
 * comes back in a slightly different sentence still has to fail.
 */
const FORBIDDEN = [
  "70%",
  "مضمون",
  "وزاري",
  "الأكثر استخدام",
  "بنك",
  "الأسعار",
  "مجان",
  "free",
  "guarantee",
  "most used",
  "ministry",
  "pricing",
];

const MESSAGES = path.resolve(import.meta.dirname, "../../messages");

function landings() {
  return ["ar", "en"].map((locale) => {
    const file = path.join(MESSAGES, `${locale}.json`);
    const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(catalog.landing, `${locale}.json has no landing namespace`);
    return { locale, landing: catalog.landing };
  });
}

test("the landing catalogue exists in both languages", () => {
  const all = landings();
  assert.equal(all.length, 2);
  for (const { locale, landing } of all) {
    assert.ok(Object.keys(landing).length > 5, `${locale} landing looks empty`);
  }
});

for (const { locale, landing } of landings()) {
  const flat = JSON.stringify(landing, null, 2);
  const lower = flat.toLowerCase();

  for (const needle of FORBIDDEN) {
    test(`[${locale}] the landing never says "${needle}"`, () => {
      assert.equal(
        lower.includes(needle.toLowerCase()),
        false,
        `the ${locale} landing catalogue contains "${needle}"`,
      );
    });
  }

  test(`[${locale}] no percentage or time-saving claim survives`, () => {
    // A bare percentage is a promise about the teacher's time, and nothing on
    // this page is measured. Dates and grade numbers are digits without a sign.
    const claim = flat.match(/\d+\s*%/g) ?? [];
    assert.deepEqual(claim, [], `percentage claim(s) found: ${claim.join(", ")}`);
  });

  test(`[${locale}] no guarantee vocabulary`, () => {
    const guilty = /(مضمون|ضمان|نضمن|guarantee|guaranteed|warrant|مؤكد)/i.test(flat);
    assert.equal(guilty, false, "the landing promises a guarantee");
  });
}
