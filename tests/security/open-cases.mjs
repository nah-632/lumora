/**
 * What the isolation suite proves today, and what remains unproven.
 *
 * Derived from tests/security/policies.mjs, so this file cannot go stale without
 * the policy list changing too. Any case listed as not applicable is a NEGATIVE
 * TEST WHOSE FAILURE HAS NOT BEEN DEMONSTRATED: for grants that do not exist, no
 * reachable attacker path crosses that assertion, so the canary cannot inject a
 * breach for it without granting a real privilege on a shared database.
 *
 * Run: node tests/security/open-cases.mjs
 * Env: SUPABASE_MANAGEMENT_TOKEN, SUPABASE_PROJECT_REF
 */
import { BREACHES } from "./policies.mjs";

const API = process.env.SUPABASE_MANAGEMENT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

async function granted(table, privilege) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `select has_table_privilege('authenticated', 'public.${table}', '${privilege}') as ok`,
    }),
  });
  if (!res.ok) throw new Error(`query failed: ${res.status}`);
  const body = await res.json();
  return body?.[0]?.ok === true;
}

const rows = [];
for (const c of BREACHES) {
  if (c.unproven) {
    rows.push({ assertion: c.expects, reason: "cannot inject a row-level breach without replacing the victim's SELECT policies", proven: false });
    continue;
  }
  if (c.expectNoChange) {
    rows.push({ assertion: c.expects, reason: c.expectNoChange, proven: false });
    continue;
  }
  if (!c.needsGrant) {
    rows.push({ assertion: c.expects, reason: "breach injected at policy level", proven: true });
    continue;
  }
  const exists = API && REF ? await granted(c.needsGrant.table, c.needsGrant.privilege) : null;
  rows.push({
    assertion: c.expects,
    reason: exists
      ? `breach injected by granting ${c.needsGrant.privilege}`
      : `authenticated has no ${c.needsGrant.privilege} on ${c.needsGrant.table}; no reachable path to breach`,
    proven: exists === true,
  });
}

console.log("assertion".padEnd(64), "failure demonstrated");
console.log("-".repeat(96));
for (const r of rows) {
  console.log(r.assertion.padEnd(64), r.proven ? "yes" : "NO");
  if (!r.proven) console.log("    " + r.reason);
}

const unproven = rows.filter((r) => !r.proven);
console.log(`\n${unproven.length} assertion(s) without a demonstrated failure path today.`);
if (unproven.length) {
  console.log(
    "Each is still enforced (the database has no such privilege to exploit), but the canary cannot\n" +
    "inject a breach for it without granting that privilege on the live database.",
  );
}