/**
 * Retrieval adapter — the database-side thin layer.
 *
 * Tests the adapter against a fake transport, so nothing here touches the
 * network. The live behaviour of `search_curriculum_text()` against the test
 * project is exercised in the migration (verified-only, empty-when-broad-missing
 * semantics) and, if present, the isolation suite.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { SessionCurriculumQuery, gradeToLevel } from "../../build-test/curriculum-query.mjs";

function fakeTransport(rows = [], status = 200) {
  const calls = [];
  return {
    calls,
    transport: async (path, body) => {
      calls.push({ path, body });
      if (status !== 200) return { ok: false, status, data: null };
      return { ok: true, status: 200, data: rows };
    },
  };
}

const ROW = {
  document_id: "d-1",
  source_id: "s-1",
  source_title: "Grade 8 Math Term 2",
  source_url: "https://www.edunet.bh",
  lesson_topic: "التحليل إلى العوامل",
  unit_number: 3,
  text_content: "Resolve a quadratic.",
};

test("search maps rows onto the prompt-safe shape and drops nothing essential", async () => {
  const { transport, calls } = fakeTransport([ROW]);
  const q = new SessionCurriculumQuery(transport);
  const matches = await q.search({
    subject: "math",
    gradeLevel: 8,
    lessonTopic: "التحليل إلى العوامل",
    term: 2,
    limit: 3,
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].sourceTitle, "Grade 8 Math Term 2");
  assert.equal(matches[0].sourceUrl, "https://www.edunet.bh");
  assert.equal(matches[0].textContent, "Resolve a quadratic.");

  // The adapter must have asked for the function with the right arguments.
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /rpc\/search_curriculum_text/);
  const sent = JSON.parse(calls[0].body);
  assert.equal(sent.p_subject, "math");
  assert.equal(sent.p_grade_level, 8);
  assert.equal(sent.p_lesson_topic, "التحليل إلى العوامل");
  assert.equal(sent.p_term, 2);
});

test("search clamps p_limit to 10", async () => {
  const { transport, calls } = fakeTransport([]);
  const q = new SessionCurriculumQuery(transport);
  await q.search({ subject: "math", gradeLevel: 8, lessonTopic: null, term: null, limit: 999 });
  assert.equal(JSON.parse(calls[0].body).p_limit, 10);
});

test("search returns [] on a transport failure (not 500, and groundless is safer than dead)", async () => {
  const { transport } = fakeTransport([], 503);
  const q = new SessionCurriculumQuery(transport);
  const matches = await q.search({ subject: "math", gradeLevel: 8, lessonTopic: null, term: null, limit: 3 });
  assert.deepEqual(matches, []);
});

test("search returns [] on a thrown transport and logs the fact, not the topic", async () => {
  const logged = [];
  const throwing = async () => {
    throw new Error("connection reset");
  };
  const q = new SessionCurriculumQuery(throwing, { warn: (f) => logged.push(f) });
  const matches = await q.search({
    subject: "math",
    gradeLevel: 8,
    lessonTopic: null,
    term: null,
    limit: 3,
  });
  assert.deepEqual(matches, []);
  assert.ok(logged.length >= 1);
  assert.equal(logged[0].code, "curriculum_lookup_threw");
});

test("search filters out rows it cannot map (missing document_id)", async () => {
  const { transport } = fakeTransport([ROW, { source_title: "no id here" }]);
  const q = new SessionCurriculumQuery(transport);
  const matches = await q.search({ subject: "math", gradeLevel: 8, lessonTopic: null, term: null, limit: 3 });
  assert.equal(matches.length, 1);
});

test("gradeToLevel maps the registry string onto a number", () => {
  assert.equal(gradeToLevel("8"), 8);
  assert.equal(gradeToLevel("9"), 9);
  assert.equal(gradeToLevel("not-a-grade"), 0); // unparseable -> 0, which matches no row
});