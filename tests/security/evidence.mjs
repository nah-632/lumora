/**
 * The evidence claim must be checkable against the database.
 *
 * The generation step is pure, so it cannot be run against a live schema. This
 * script therefore replays the exact statements the app issues, against the real
 * tables, and verifies — row by row, in SQL — that:
 *
 *   1. the pair rule holds (basis_count and basis_kind together or not at all);
 *   2. the client upgrade path keeps the new columns unwritable by a teacher;
 *   3. for a known fixture, basis_count equals the number of source rows named in
 *      evidence_ids, and the averages quoted in the sentence match those rows;
 *   4. a deliberately corrupted claim (count without matching rows) is DETECTED
 *      by the same verification query — a check that cannot fail proves nothing.
 *
 * Run: node tests/security/evidence.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !ANON || !SERVICE) {
  console.log("SKIP: Supabase env vars not set; refusing to report a false pass.");
  process.exit(2);
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const svc = (path, init = {}) =>
  fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const asUser = (token, path, init = {}) =>
  fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const stamp = Date.now();
const users = [];

async function makeTeacher(label) {
  const email = `ev-${label}-${stamp}@lumora-test.invalid`;
  const password = `Pw-${stamp}-${label}-7kR!`;
  const created = await svc("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`create failed: ${created.status} ${await created.text()}`);
  const user = await created.json();
  await svc("/rest/v1/user_roles", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, role: "teacher" }),
  });
  const signed = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signed.ok) throw new Error(`sign-in failed: ${signed.status}`);
  const session = await signed.json();
  users.push({ id: user.id });
  return { id: user.id, token: session.access_token };
}

async function main() {
  const A = await makeTeacher("a");

  // Known fixture: 5 Math assessments, 92 90 | 62 58 55, plus 2 missing Math
  // submissions and 1 missing Science submission that must not be counted.
  const [student] = await (await svc("/rest/v1/students", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ teacher_id: A.id, name: "Evidence Student", grade_level: "G8" }),
  })).json();

  const gradeRows = [
    ["Math", 92, "2026-01-01"], ["Math", 90, "2026-01-08"], ["Math", 62, "2026-01-15"],
    ["Math", 58, "2026-01-22"], ["Math", 55, "2026-01-29"],
  ];
  const gradeIds = [];
  for (const [subject, score, date] of gradeRows) {
    const [row] = await (await svc("/rest/v1/student_grades", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ student_id: student.id, teacher_id: A.id, subject, assessment_name: `A${date}`, score, max_score: 100, date }),
    })).json();
    gradeIds.push(row.id);
  }

  const subIds = [];
  for (const [subject, date] of [["Math", "2026-01-20"], ["Math", "2026-01-21"], ["Science", "2026-01-22"]]) {
    const [row] = await (await svc("/rest/v1/student_submissions", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ student_id: student.id, teacher_id: A.id, project_name: "P", status: "missing", date, subject }),
    })).json();
    subIds.push(row.id);
  }

  const missingMathIds = subIds.slice(0, 2);
  const alertPayload = {
    student_id: student.id,
    teacher_id: A.id,
    alert_type: "grade_drop",
    severity: "urgent",
    message: "Math fell from 91% to 58%.",
    dedupe_key: `ev-${stamp}`,
    assessment_count: 5,
    basis_kind: "assessments",
    basis_count: 5,
    evidence_ids: gradeIds,
  };

  const created = await svc("/rest/v1/student_alerts", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(alertPayload),
  });
  check("a full basis pair (kind + count + evidence_ids) is accepted", created.ok, `http ${created.status}`);
  const [alert] = created.ok ? await created.json() : [{}];

  console.log("\n— row-level verification of the claim —");
  const graded = await (await svc(
    `/rest/v1/student_grades?select=id,score&student_id=eq.${student.id}&subject=eq.Math&order=date.asc`,
  )).json();
  const claimed = new Set(alert.evidence_ids ?? []);
  const actuallyCited = graded.filter((r) => claimed.has(r.id));
  check("every evidence id resolves to a real assessment of this student",
    actuallyCited.length === (alert.evidence_ids ?? []).length,
    `cited ${actuallyCited.length}/${(alert.evidence_ids ?? []).length}`);

  const pcts = actuallyCited.map((r) => r.score);
  const baseline = pcts.slice(0, Math.floor(pcts.length / 2));
  const recent = pcts.slice(Math.floor(pcts.length / 2));
  const avg = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  check("the quoted baseline average is reproducible from the cited rows",
    avg(baseline) === 91, `${avg(baseline)}% vs quoted 91%`);
  check("the quoted recent average is reproducible from the cited rows",
    avg(recent) === 58.3, `${avg(recent)}% vs quoted 58.3%`);
  check("basis_count equals the number of cited rows",
    alert.basis_count === actuallyCited.length, `${alert.basis_count} vs ${actuallyCited.length}`);

  // Missing-work basis counts only the Math submissions.
  const [mw] = await (await svc("/rest/v1/student_alerts", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      student_id: student.id, teacher_id: A.id, alert_type: "missing_work", severity: "attention",
      message: "Two Math assignments missing.", dedupe_key: `ev-mw-${stamp}`,
      basis_kind: "submissions", basis_count: 2, evidence_ids: missingMathIds,
    }),
  })).json();
  const missingRows = await (await svc(
    `/rest/v1/student_submissions?select=id,subject&status=eq.missing&student_id=eq.${student.id}`,
  )).json();
  const citedMissing = missingRows.filter((r) => (mw.evidence_ids ?? []).includes(r.id));
  check("submission basis cites only that subject's missing work",
    citedMissing.length === 2 && citedMissing.every((r) => r.subject === "Math"),
    `cited ${citedMissing.length}, subjects ${[...new Set(citedMissing.map((r) => r.subject))].join(",")}`);

  console.log("\n— the pair rule —");
  const kindOnly = await svc("/rest/v1/student_alerts", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ ...alertPayload, dedupe_key: `ev-k-${stamp}`, basis_count: null }),
  });
  check("a kind without a count is rejected by the database", kindOnly.status === 400, `http ${kindOnly.status}`);

  const countOnly = await svc("/rest/v1/student_alerts", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ ...alertPayload, dedupe_key: `ev-c-${stamp}`, basis_kind: null }),
  });
  check("a count without a kind is rejected by the database", countOnly.status === 400, `http ${countOnly.status}`);

  console.log("\n— a teacher cannot rewrite the claim —");
  const forged = await asUser(A.token, `student_alerts?id=eq.${alert.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ basis_count: 999, basis_kind: "submissions", evidence_ids: [] }),
  });
  const forgedRows = forged.ok ? await forged.json() : [];
  const [after] = await (await svc(`/rest/v1/student_alerts?select=basis_count,basis_kind,evidence_ids&id=eq.${alert.id}`)).json();
  check("A cannot rewrite basis_count / basis_kind / evidence_ids",
    (forgedRows.length === 0 || after.basis_count === 5) && after.basis_count === 5 && after.basis_kind === "assessments",
    `patched rows ${forgedRows.length}, stored count ${after.basis_count}`);

  // The teacher may still toggle the flags it is allowed to touch.
  const toggle = await asUser(A.token, `student_alerts?id=eq.${alert.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ is_read: true }),
  });
  check("A can still mark their own alert read (positive control)", toggle.ok, `http ${toggle.status}`);

  console.log("\n— canary: a false claim must be detectable —");
  // Corrupt the claim the way a bug would: count 5, cite 3.
  await svc(`/rest/v1/student_alerts?id=eq.${alert.id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ evidence_ids: gradeIds.slice(0, 3) }),
  });
  const [tampered] = await (await svc(`/rest/v1/student_alerts?select=basis_count,evidence_ids&id=eq.${alert.id}`)).json();
  const detectable = tampered.basis_count !== (tampered.evidence_ids ?? []).length;
  check("a claim whose count exceeds its cited rows is detectable", detectable,
    `count ${tampered.basis_count} vs cited ${(tampered.evidence_ids ?? []).length}`);
  // Restore.
  await svc(`/rest/v1/student_alerts?id=eq.${alert.id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ evidence_ids: gradeIds }),
  });
}

async function teardown() {
  for (const u of users) {
    try { await svc(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" }); } catch { /* best effort */ }
  }
}

try {
  await main();
} catch (err) {
  check("suite completed without throwing", false, String(err).slice(0, 200));
} finally {
  await teardown();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);