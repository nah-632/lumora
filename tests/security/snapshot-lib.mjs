/**
 * Policy snapshot / restore.
 *
 *   node tests/security/snapshot.mjs           -> prints the current definitions as JSON
 *   node tests/security/restore.mjs            -> reapplies them (used after a canary)
 *
 * Why this exists: the canary drops policies to prove the suite notices. If the
 * runner dies mid-run, the database keeps the breach. The snapshot is what a
 * crash recovery reads — and it is also the ground truth the canary's hard-coded
 * restore list is checked against by tests/security/policies.test.mjs.
 *
 * Env: SUPABASE_MANAGEMENT_TOKEN, SUPABASE_PROJECT_REF
 */
const API = process.env.SUPABASE_MANAGEMENT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

export const TABLES = [
  "students",
  "student_grades",
  "student_submissions",
  "student_alerts",
  "student_interventions",
  "teacher_alert_settings",
];

export async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export async function readPolicies() {
  const rows = await query(`
    select tablename, policyname, cmd, roles::text as roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (${TABLES.map((t) => `'${t}'`).join(", ")})
    order by tablename, policyname
  `);
  return rows;
}

/** Rebuilds `create policy` statements from the catalogue. */
export function toCreateStatements(rows) {
  return rows.map((r) => {
    const roles = (r.roles ?? "public").replace(/^\{|\}$/g, "");
    const parts = [`create policy "${r.policyname}" on public.${r.tablename}`, `for ${r.cmd.toLowerCase()} to ${roles}`];
    if (r.qual) parts.push(`using (${r.qual})`);
    if (r.with_check) parts.push(`with check (${r.with_check})`);
    return `${parts.join(" ")};`;
  });
}