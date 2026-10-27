/**
 * Cross-tenant soft delete and restore.
 *
 * A new file rather than an addition to isolation.mjs: that suite is long, and the
 * instruction was explicit that existing tests are not edited. This runs on its own:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... node tests/security/soft-delete-cross-tenant.mjs
 *
 * Both functions are SECURITY DEFINER, so they run with the owner's rights and RLS
 * never sees the caller. The only thing standing between teacher A and teacher B's
 * student is the `and teacher_id = v_teacher` in the WHERE clause. This proves that
 * clause is load-bearing rather than decorative: it fails if A's call ever changes
 * B's row.
 *
 * Asserts state, not status codes. PostgREST renders the functions' `P0002` as 500,
 * which is ugly but not a breach, so a status-code assertion would either be wrong
 * or would enshrine the ugliness. What matters is that the row did not move.
 */
import { randomUUID } from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.log("SKIP: Supabase credentials not set.");
  process.exit(3);
}

const svcHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name} — ${detail}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

async function rest(path, init = {}, headers = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...headers },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function makeTeacher(label, tag) {
  const email = `sdct-${label}-${tag}@lumora-test.invalid`;
  const password = randomUUID();
  const created = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svcHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).then((r) => r.json());
  const token = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  return { id: created.id, token: token.access_token };
}

const tag = randomUUID().slice(0, 8);
const created = { users: [], students: [] };

try {
  const A = await makeTeacher("a", tag);
  const B = await makeTeacher("b", tag);
  created.users.push(A.id, B.id);

  const row = await rest(
    "students",
    {
      method: "POST",
      headers: { ...svcHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ teacher_id: B.id, name: `Victim-${tag}`, grade_level: "G8" }),
    },
  );
  const studentId = row.body?.[0]?.id;
  if (!studentId) throw new Error(`fixture failed: ${JSON.stringify(row.body)}`);
  created.students.push(studentId);

  const asA = { apikey: ANON, Authorization: `Bearer ${A.token}` };

  await rest("rpc/soft_delete_student", { method: "POST", body: JSON.stringify({ p_student_id: studentId }) }, asA);
  const afterDelete = await rest(`students?id=eq.${studentId}&select=deleted_at`, {}, svcHeaders);
  check(
    "A cannot soft-delete B's student",
    (afterDelete.body?.[0]?.deleted_at ?? null) === null,
    `deleted_at is still null after A's call`,
  );

  // Now soft-delete it properly, as B, so restore has something to refuse.
  await rest("rpc/soft_delete_student", { method: "POST", body: JSON.stringify({ p_student_id: studentId }) },
    { apikey: ANON, Authorization: `Bearer ${B.token}` });
  const softDeleted = await rest(`students?id=eq.${studentId}&select=deleted_at`, {}, svcHeaders);
  const stampBefore = softDeleted.body?.[0]?.deleted_at ?? null;

  await rest("rpc/restore_student", { method: "POST", body: JSON.stringify({ p_student_id: studentId }) }, asA);
  const afterRestore = await rest(`students?id=eq.${studentId}&select=deleted_at`, {}, svcHeaders);
  const stampAfter = afterRestore.body?.[0]?.deleted_at ?? null;

  check(
    "A cannot restore B's student",
    stampBefore !== null && stampAfter === stampBefore,
    `deleted_at unchanged by A's call`,
  );
} finally {
  for (const id of created.students) {
    await rest(`students?id=eq.${id}`, { method: "DELETE" }, svcHeaders);
  }
  for (const id of created.users) {
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svcHeaders });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);