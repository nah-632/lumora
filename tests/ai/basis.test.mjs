/**
 * basis_kind / basis_count — proven with known data.
 *
 * The product sentence is "Based on N assessments" / "Based on N submissions".
 * These tests build a fixture whose records are counted by hand in the comment,
 * then assert the generator reproduces the same numbers and names the same rows.
 *
 * Run with: node --test tests/ai/basis.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { computeStudentSignals, signalEvidence } = await import("../../build-test/signals.mjs");
const { generateAlerts } = await import("../../build-test/generate-alerts.mjs");
const { computeBasis, isFiringFor } = await import("../../build-test/alert-basis.mjs");

let nextId = 0;
const uid = () => {
  nextId += 1;
  const hex = nextId.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
};

/** A grade row with a real id, so evidence can be checked row by row. */
const g = (subject, score, date) => ({ id: uid(), studentId: "x", subject, score, maxScore: 100, date });
const s = (status, date, subject = "Math") => ({ id: uid(), studentId: "x", status, date, subject });

const providerReturning = (alerts) => ({
  name: "mock",
  model: "m",
  isConfigured: () => true,
  generate: async () => ({
    text: JSON.stringify({ alerts }),
    provider: "mock",
    model: "m",
    inputTokens: null,
    outputTokens: null,
    latencyMs: 1,
    costEstimated: true,
    costUsd: 0,
  }),
});

/**
 * FIXTURE — 5 assessments in Math, marking 92, 90, 62, 58, 55.
 *
 *   baseline (older half, 2 marks) : 92, 90   -> 91.0%
 *   recent   (newer half, 3 marks) : 62, 58, 55 -> 58.3%
 *   delta  = 58.3 - 91.0 = -32.7  -> a decline past the 20pt default
 *
 * So a grade-drop alert on this subject is based on ALL 5 assessments.
 */
function mathDropFixture() {
  const grades = [
    g("Math", 92, "2026-01-01"),
    g("Math", 90, "2026-01-08"),
    g("Math", 62, "2026-01-15"),
    g("Math", 58, "2026-01-22"),
    g("Math", 55, "2026-01-29"),
  ];
  return grades;
}

test("known data: grade-drop alert reports N = 5 assessments, the rows it compared", async () => {
  const grades = mathDropFixture();
  const student = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", gradeLevel: "G8", grades, submissions: [] };

  const res = await generateAlerts(
    [student],
    ["Student Name"],
    "en",
    20,
    { provider: providerReturning([
      { ref: "s1", alertType: "grade_drop", severity: "urgent", message: "Math fell from 91% to 58%.", evidence: "Math 91% -> 58%" },
    ]) },
  );

  assert.equal(res.ok, true);
  assert.equal(res.prepared.length, 1);
  const alert = res.prepared[0];

  // The sentence the teacher reads.
  assert.equal(alert.basisKind, "assessments");
  assert.equal(alert.basisCount, 5, `expected 5 assessments, got ${alert.basisCount}`);

  // The claim is checkable: exactly the five ids used in the computation.
  assert.deepEqual(
    alert.evidenceParts.map((p) => p.role).sort(),
    ["baseline", "baseline", "recent", "recent", "recent"],
  );
  assert.deepEqual(
    alert.evidenceIds.slice().sort(),
    grades.map((r) => r.id).sort(),
    "evidence ids must be exactly the assessments examined",
  );

  // And re-deriving from those ids gives the same averages the alert quotes.
  const ev = signalEvidence("Math", grades, []);
  assert.equal(ev.baselineAveragePct, 91);
  assert.equal(ev.recentAveragePct, 58.3);
});

test("known data: missing-work alert reports N = 2 submissions, not the assessments", async () => {
  // 3 assessments, steady marks — no trend; and 2 missing submissions in Math
  // plus 1 missing in Science that must NOT be counted against Math.
  const grades = [
    g("Math", 80, "2026-01-01"),
    g("Math", 81, "2026-01-08"),
    g("Math", 80, "2026-01-15"),
    g("Science", 77, "2026-01-20"),
  ];
  const submissions = [
    s("missing", "2026-01-16", "Math"),
    s("missing", "2026-01-18", "Math"),
    s("missing", "2026-01-21", "Science"),
    s("submitted", "2026-01-22", "Math"),
  ];
  const student = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", gradeLevel: "G8", grades, submissions };

  const res = await generateAlerts(
    [student],
    ["Student Name"],
    "ar",
    20,
    { provider: providerReturning([
      { ref: "s1", alertType: "missing_work", severity: "attention", message: "واجبان غير مسلّمين في الرياضيات.", evidence: "Math 2 missing" },
    ]) },
  );

  assert.equal(res.ok, true);
  const alert = res.prepared[0];

  assert.equal(alert.basisKind, "submissions");
  assert.equal(alert.basisCount, 2, `expected 2 submissions, got ${alert.basisCount}`);
  assert.equal(alert.assessmentCount, 3, "assessment_count stays the grades examined");

  const missingIds = submissions.filter((x) => x.status === "missing" && x.subject === "Math").map((x) => x.id);
  assert.deepEqual(alert.evidenceIds.slice().sort(), missingIds.slice().sort());
});

test("the basis sentence is rendered from the kind, never guessed", () => {
  // grade_drop -> assessments
  assert.deepEqual(computeBasis({ alertType: "grade_drop", gradesConsidered: 4, missingCount: 0, missingIsNotable: false }), {
    kind: "assessments",
    count: 4,
  });
  // missing_work -> submissions
  assert.deepEqual(computeBasis({ alertType: "missing_work", gradesConsidered: 3, missingCount: 2, missingIsNotable: true }), {
    kind: "submissions",
    count: 2,
  });
  // follow_up resting on both kinds -> no sentence at all
  assert.equal(computeBasis({ alertType: "follow_up", gradesConsidered: 3, missingCount: 2, missingIsNotable: true }), null);
  // nothing to count -> no sentence
  assert.equal(computeBasis({ alertType: "grade_drop", gradesConsidered: 0, missingCount: 0, missingIsNotable: false }), null);
});

test("an alert type the signal does not support gets no basis", async () => {
  // Steady Math with no missing work: "missing_work" here would be a fiction.
  const grades = [
    g("Math", 80, "2026-01-01"),
    g("Math", 80, "2026-01-08"),
    g("Math", 80, "2026-01-15"),
  ];
  const student = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", gradeLevel: "G8", grades, submissions: [] };
  const res = await generateAlerts([student], ["N"], "en", 20, {
    provider: providerReturning([
      { ref: "s1", alertType: "missing_work", severity: "attention", message: "Two assignments missing.", evidence: "Math" },
    ]),
  });
  // The student is not notable, so nothing is even sent.
  assert.equal(res.prepared.length, 0);
  assert.equal(isFiringFor({ trend: "steady", missingCount: 0 }, "missing_work"), false);
});

test("evidence ids are only listed when they exist", async () => {
  // No ids at all (a caller that has not selected them): the count still stands,
  // but nothing is claimed about which rows.
  const grades = mathDropFixture().map(({ id, ...rest }) => rest);
  const student = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", gradeLevel: "G8", grades, submissions: [] };
  const res = await generateAlerts([student], ["N"], "en", 20, {
    provider: providerReturning([
      { ref: "s1", alertType: "grade_drop", severity: "urgent", message: "Math fell.", evidence: "Math" },
    ]),
  });
  assert.equal(res.prepared[0].basisCount, 5);
  assert.deepEqual(res.prepared[0].evidenceIds, []);
  const evidence = signalEvidence("Math", grades, []).baseline;
  assert.equal(evidence.length, 2);
});