import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPrompt } from "../../build-test/generate.mjs";

/**
 * Truth check for the privacy statement on the landing page.
 *
 * THE FINDING, from the real code rather than from documentation:
 *
 *   `studentName` never leaves the process. `buildPrompt` drops its line
 *   outright, and it is dropped in the prompt builder rather than in the
 *   template so a later edit to the template cannot reintroduce it.
 *
 *   `notes` DOES reach the model. It is free text up to 500 characters, it is
 *   forwarded verbatim inside a fence, and it therefore carries whatever the
 *   teacher typed — including a child's name.
 *
 * So the reference mockup's chip — "you decide what is sent" — cannot be proven
 * as written: the app does not filter that box, and it makes no promise about
 * what a teacher puts in it. What CAN be proven is the narrower statement the
 * page actually ships: the student-name FIELD is not sent.
 *
 * These tests do two jobs. They prove the claim that is on the page, and they
 * pin the limitation that forced the rewrite — if `notes` ever stops being
 * forwarded, the second test fails and the page's copy is due a second look.
 */
const MESSAGES = path.resolve(import.meta.dirname, "../../messages");

const NAME = "NAME_TOKEN_9F2A";
const NOTES = "NOTES_TOKEN_7C1B — ضعيف في الكسور";

function remedial() {
  return buildPrompt("remedial-plan", {
    outputLanguage: "ar",
    grade: "8",
    subject: "math",
    score: 42,
    difficultyTags: ["foundational-gaps"],
    studentName: NAME,
    notes: NOTES,
  });
}

const whole = (built) => `${built.system}\n${built.user}`;

test("the student-name field never reaches the model", () => {
  const built = remedial();
  assert.equal(
    whole(built).includes(NAME),
    false,
    "the student's name reached the prompt — the page's claim is now false",
  );
});

test("the free-text notes field does reach the model", () => {
  const built = remedial();
  assert.equal(
    whole(built).includes(NOTES),
    true,
    "notes are no longer forwarded; the landing copy about what is sent can be re-examined",
  );
});

test("free-text topic on the other tools reaches the model too", () => {
  const built = buildPrompt("lesson-plan", {
    outputLanguage: "en",
    grade: "8",
    subject: "math",
    duration: "45",
    teachingStyles: ["direct"],
    topic: "TOPIC_TOKEN_3D4E",
  });
  assert.equal(whole(built).includes("TOPIC_TOKEN_3D4E"), true);
});

for (const locale of ["ar", "en"]) {
  const landing = JSON.parse(
    fs.readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8"),
  ).landing;

  test(`[${locale}] the shipped chip claims only what the builder proves`, () => {
    const claim = landing.chips.studentName;

    // It must name the FIELD, not "the student's name": a name typed into the
    // notes box is sent, so a claim about names in general would be false.
    assert.match(
      claim,
      locale === "ar" ? /حقل/ : /field/i,
      "the chip must scope the claim to the student-name field",
    );

    // And it must not be the mockup's unprovable wording.
    assert.doesNotMatch(
      claim,
      locale === "ar" ? /أنت تقرر ما يُرسل/ : /you decide what is sent/i,
      "the mockup's claim cannot be proven and must not ship",
    );
  });
}
