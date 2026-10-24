/**
 * Proves the isolation suite can actually fail.
 *
 * A security test that cannot fail is worse than no test: it reports green while
 * proving nothing. This script injects a deliberate breach into the database,
 * runs the isolation suite, and REQUIRES it to fail — then restores the schema.
 *
 * It needs the same credentials as the isolation suite, plus a database
 * connection to change policies. When those are absent it reports SKIP rather
 * than pretending to pass.
 */
import { spawnSync } from "node:child_process";

const API = process.env.SUPABASE_MANAGEMENT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const SUITE = "tests/security/isolation.mjs";

if (!API || !REF) {
  console.log("SKIP: SUPABASE_MANAGEMENT_TOKEN / SUPABASE_PROJECT_REF not set — cannot inject a breach.");
  process.exit(3);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`sql failed: ${res.status} ${await res.text()}`);
}

function runSuite() {
  const r = spawnSync(process.execPath, [SUITE], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const BREACH = `
  drop policy if exists student_alerts_select_own on public.student_alerts;
  create policy student_alerts_select_own on public.student_alerts
    for select to authenticated using (true);
  grant delete on public.student_alerts to authenticated;
  drop policy if exists canary_del on public.student_alerts;
  create policy canary_del on public.student_alerts
    for delete to authenticated using (true);
`;

const RESTORE = `
  drop policy if exists student_alerts_select_own on public.student_alerts;
  create policy student_alerts_select_own on public.student_alerts
    for select to authenticated
    using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));
  drop policy if exists canary_del on public.student_alerts;
  revoke delete on public.student_alerts from authenticated;
`;

let failed = false;

try {
  console.log("— baseline: the suite must pass —");
  const base = runSuite();
  if (base.code !== 0) {
    console.log(base.out);
    console.log("BASELINE FAILED: fix the suite before testing whether it detects a breach.");
    process.exit(1);
  }
  console.log("  baseline OK");

  console.log("— injecting a breach: permissive SELECT + DELETE on alerts —");
  await sql(BREACH);

  console.log("— the suite must now FAIL —");
  const broken = runSuite();
  if (broken.code === 0) {
    console.log(broken.out);
    console.log("CANARY FAILED: the suite passed while the database was deliberately breached.");
    failed = true;
  } else {
    const detected = /row survives|saw 1/.test(broken.out);
    console.log(detected ? "  breach detected as expected" : "  suite failed, but not on the expected assertion");
    if (!detected) failed = true;
  }
} finally {
  await sql(RESTORE);
  console.log("— schema restored —");
}

process.exit(failed ? 1 : 0);
