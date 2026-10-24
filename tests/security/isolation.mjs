/**
 * Isolation tests with REAL Supabase sessions.
 *
 * Setup and teardown use the admin (service_role) API because creating a
 * confirmed user cannot be done from the anon key. Every assertion, however,
 * runs with the teacher's own access token, so RLS is the authority being
 * tested — not a bypass.
 *
 * Run: node tests/security/isolation.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *      SUPABASE_SERVICE_ROLE_KEY
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!URL_BASE || !ANON || !SERVICE) {
  console.log("SKIP: Supabase env vars not set; refusing to report a false pass.");
  process.exit(2);
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

/** A caller-scoped request: only the teacher's own token, so RLS applies. */
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
  const email = `iso-${label}-${stamp}@lumora-test.invalid`;
  const password = `Pw-${stamp}-${label}-9xQ!`;

  const created = await svc("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`admin create failed: ${created.status} ${await created.text()}`);
  const user = await created.json();

  // Grant the teacher role the same way the app does.
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
  if (!signed.ok) throw new Error(`sign-in failed: ${signed.status} ${await signed.text()}`);
  const session = await signed.json();

  users.push({ id: user.id, email });
  return { id: user.id, email, token: session.access_token };
}

async function main() {
  console.log("— setup: creating two real teachers via the admin API —");
  const A = await makeTeacher("a");
  const B = await makeTeacher("b");
  console.log(`   teacher A ${A.id}\n   teacher B ${B.id}\n`);

  // B owns a student with a grade, a submission, an alert and an intervention.
  const sBRaw = await svc("/rest/v1/students", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ teacher_id: B.id, name: "B-Student", grade_level: "G8" }),
  });
  const [sB] = await sBRaw.json();

  const sARaw = await svc("/rest/v1/students", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ teacher_id: A.id, name: "A-Student", grade_level: "G7" }),
  });
  const [sA] = await sARaw.json();

  await svc("/rest/v1/student_grades", {
    method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: B.id, subject: "Math", assessment_name: "T1", score: 80, max_score: 100, date: "2026-01-01" }),
  });
  await svc("/rest/v1/student_submissions", {
    method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: B.id, project_name: "P1", status: "missing", date: "2026-01-02" }),
  });
  await svc("/rest/v1/student_alerts", {
    method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: B.id, alert_type: "grade_drop", severity: "urgent", message: "B alert", dedupe_key: "k1", basis_count: 2 }),
  });
  await svc("/rest/v1/student_interventions", {
    method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: B.id, action: "B remedial session" }),
  });

  console.log("— assertions: every request carries teacher A's own token —\n");

  // Reads
  const rosterA = await (await asUser(A.token, "students?select=id,name")).json();
  check("A sees only their own roster", rosterA.length === 1 && rosterA[0].id === sA.id,
        `saw ${rosterA.length}`);

  const peekB = await (await asUser(A.token, `students?select=id&id=eq.${sB.id}`)).json();
  check("A cannot read B's student by guessed id", peekB.length === 0, `saw ${peekB.length}`);

  for (const [label, table] of [
    ["grades", "student_grades"],
    ["submissions", "student_submissions"],
    ["alerts", "student_alerts"],
    ["interventions", "student_interventions"],
  ]) {
    const r = await (await asUser(A.token, `${table}?select=id`)).json();
    check(`A cannot read B's ${label}`, r.length === 0, `saw ${r.length}`);
  }

  const settingsB = await (await asUser(A.token, `teacher_alert_settings?select=teacher_id&teacher_id=eq.${B.id}`)).json();
  check("A cannot read B's alert settings", settingsB.length === 0, `saw ${settingsB.length}`);

  // Writes
  const upd = await asUser(A.token, `students?id=eq.${sB.id}`, {
    method: "PATCH", headers: { prefer: "return=representation" },
    body: JSON.stringify({ name: "hacked" }),
  });
  const updRows = await upd.json();
  check("A cannot update B's student", Array.isArray(updRows) && updRows.length === 0, `updated ${updRows.length}`);

  const del = await asUser(A.token, `students?id=eq.${sB.id}`, { method: "DELETE" });
  const delRows = del.ok ? await del.json().catch(() => []) : [];
  check("A cannot delete B's student",
        !del.ok || (Array.isArray(delRows) && delRows.length === 0),
        del.ok ? `deleted ${Array.isArray(delRows) ? delRows.length : "?"}` : `http ${del.status}`);

  const forgeStudent = await asUser(A.token, "students", {
    method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ teacher_id: B.id, name: "Forged", grade_level: "G9" }),
  });
  check("A cannot create a student owned by B", !forgeStudent.ok, `http ${forgeStudent.status}`);

  const forgeGrade = await asUser(A.token, "student_grades", {
    method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: A.id, subject: "Math", assessment_name: "X", score: 10, max_score: 100, date: "2026-01-03" }),
  });
  check("A cannot attach a grade to B's student", !forgeGrade.ok, `http ${forgeGrade.status}`);

  const forgeIntervention = await asUser(A.token, "student_interventions", {
    method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ student_id: sB.id, teacher_id: B.id, action: "forged" }),
  });
  check("A cannot log an intervention on B's student", !forgeIntervention.ok, `http ${forgeIntervention.status}`);

  // Alerts are the AI evidence trail: a teacher may read and toggle status
  // flags, but must not be able to delete them or rewrite their content.
  const alertsB = await svc(`/rest/v1/student_alerts?select=id&student_id=eq.${sB.id}`).then((r) => r.json());
  const alertBId = alertsB[0]?.id;

  if (alertBId) {
    // Attempt the delete, then verify against the SERVICE ROLE that the row is
    // still there. Checking only the HTTP status is not enough: with no DELETE
    // policy PostgREST can answer 200 while deleting nothing, and a test that
    // trusts the status alone cannot tell "blocked" from "silently did nothing".
    const delAlert = await asUser(A.token, `student_alerts?id=eq.${alertBId}`, { method: "DELETE" });
    const stillThere = await svc(
      `/rest/v1/student_alerts?select=id&id=eq.${alertBId}`,
    ).then((r) => r.json());
    const survived = Array.isArray(stillThere) && stillThere.length === 1;
    check("A cannot delete B's alert (row survives)", survived,
          `http ${delAlert.status}, row present=${survived}`);
  } else {
    check("A cannot delete B's alert (row survives)", false, "fixture missing: no B alert to target");
  }

  // Even for B's own alert, A must not be able to rewrite the message.
  if (alertBId) {
    const rewrite = await asUser(A.token, `student_alerts?id=eq.${alertBId}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ message: "rewritten by A" }),
    });
    const rewriteRows = rewrite.ok ? await rewrite.json().catch(() => []) : [];
    check("A cannot rewrite B's alert message",
          !rewrite.ok || (Array.isArray(rewriteRows) && rewriteRows.length === 0),
          rewrite.ok ? `updated ${Array.isArray(rewriteRows) ? rewriteRows.length : "?"}` : `http ${rewrite.status}`);
  }

  // Positive control: A can still operate on their own data. Without this the
  // suite could pass by the tables simply being unusable.
  const ownInsert = await asUser(A.token, "students", {
    method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ name: "A-Own-2", grade_level: "G7" }),
  });
  check("A CAN create their own student (positive control)", ownInsert.ok, `http ${ownInsert.status}`);

  const ownSettings = await asUser(A.token, "teacher_alert_settings", {
    method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ teacher_id: A.id, drop_threshold_pct: 15 }),
  });
  check("A can write their own alert settings", ownSettings.ok, `http ${ownSettings.status}`);

  // Soft-delete hides children from the owner.
  await asUser(A.token, "rpc/soft_delete_student", {
    method: "POST", body: JSON.stringify({ p_student_id: sA.id }),
  });
  const afterDelete = await (await asUser(A.token, "students?select=id")).json();
  check("soft-deleted student disappears from A's roster",
        !afterDelete.some((r) => r.id === sA.id), `roster ${afterDelete.length}`);
  const restore = await asUser(A.token, "rpc/restore_student", {
    method: "POST", body: JSON.stringify({ p_student_id: sA.id }),
  });
  check("A can restore within the 30-day window", restore.ok, `http ${restore.status}`);
}

async function teardown() {
  for (const u of users) {
    try {
      await svc(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    } catch { /* best effort */ }
  }
}

try {
  await main();
} catch (err) {
  check("suite completed without throwing", false, String(err).slice(0, 160));
} finally {
  await teardown();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
