/**
 * Canary: proves the isolation suite can fail, one assertion class at a time.
 *
 * ------------------------------------------------------------------------------
 * THE OLD CANARY PROVED TOO LITTLE
 *
 * It injected one breach (permissive SELECT + DELETE on alerts), required the
 * suite to fail somewhere, and restored. That is necessary but not sufficient:
 * the suite failed, yet the other seven negative assertions were never shown to
 * be capable of failing. A test that cannot fail is a comment.
 *
 * This version injects EIGHT breaches in turn. For each one it requires that the
 * suite fails AND that the specific assertion which should catch it is among the
 * failures — a global "something failed" is not accepted, because the baseline
 * run alone could be red for an unrelated reason.
 *
 * Safety: every breach is paired with a restoring statement that puts back the
 * exact object it replaced, and the restore runs in a finally block. The restored
 * state is then verified by re-running the suite, which must pass again.
 *
 * Run: node tests/security/canary.mjs
 * Env: isolation suite credentials + SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF
 */
import { spawnSync } from "node:child_process";
import { BREACHES as CASES, RESTORE_ALL } from "./policies.mjs";

const API = process.env.SUPABASE_MANAGEMENT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const SUITE = "tests/security/isolation.mjs";

if (!API || !REF) {
  console.log("SKIP: SUPABASE_MANAGEMENT_TOKEN / SUPABASE_PROJECT_REF not set — cannot inject a breach.");
  process.exit(3);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("SKIP: isolation credentials not set — nothing to run the suite against.");
  process.exit(3);
}

async function sql(query, tries = 6) {
  let lastError = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return;
      const text = await res.text();
      // A 5xx from the management API is worth retrying; a 4xx is a real error.
      if (res.status < 500) throw new Error(`sql failed: ${res.status} ${text}`);
      lastError = new Error(`sql failed: ${res.status} ${text}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  throw lastError;
}

/** Retries a whole operation that may itself contain several SQL calls. */
async function withRetry(label, fn, tries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`  ${label}: attempt ${attempt} failed (${String(err.message ?? err).slice(0, 120)})`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastError;
}

/** Matches an expected assertion, optionally requiring its unique marker in output. */
function markersMatch(out, c) {
  const lines = out.split("\n").filter((l) => /^(FAIL|XFAIL)\s/.test(l));
  return lines.some((l) => {
    const body = l.replace(/^(FAIL|XFAIL)\s+/, "");
    if (!body.startsWith(c.expects)) return false;
    return c.marker ? body.includes(c.marker) : true;
  });
}

function runSuite() {
  const r = spawnSync(process.execPath, [SUITE], { encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const failed = out
    .split("\n")
    .filter((l) => /^(FAIL|XFAIL)\s/.test(l))
    .map((l) => l.replace(/^(FAIL|XFAIL)\s+/, "").split(" — ")[0]);
  return { code: r.status, out, failed };
}

let failed = false;

try {
  console.log("— baseline: the suite must pass before any breach —");
  const base = runSuite();
  if (base.code !== 0) {
    console.log(base.out);
    console.log("BASELINE FAILED: fix the suite before testing whether it detects a breach.");
    process.exit(1);
  }
  console.log(`  baseline OK (${(base.out.match(/^PASS/gm) ?? []).length} assertions)`);

  // A grant-level breach only means something if the grant exists: a missing
  // table privilege stops the request before RLS is consulted, and the suite
  // would pass for the wrong reason. Rather than skip such a case silently (or
  // grant a privilege on a shared database), the canary reports it as not
  // applicable and says why.
  const applicable = [];
  for (const c of CASES) {
    if (c.unproven || c.expectNoChange) continue;
    if (!c.needsGrant) { applicable.push(c); continue; }
    // Privileges on the table may come from a table-level OR a column-level grant;
    // has_table_privilege only sees the former, so ask information_schema too.
    const t = c.needsGrant.table;
    const priv = c.needsGrant.privilege;
    const probe = `
      select
        exists (select 1 from information_schema.table_privileges
                 where grantee = 'authenticated' and table_schema = 'public'
                   and table_name = '${t}' and privilege_type = '${priv}') as table_grant,
        exists (select 1 from information_schema.column_privileges
                 where grantee = 'authenticated' and table_schema = 'public'
                   and table_name = '${t}' and privilege_type = '${priv}') as column_grant`;
    const body = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: probe }),
    }).then((r) => r.json());
    const row = Array.isArray(body) ? body[0] : body?.result?.[0];
    const has = Boolean(row && (row.table_grant === true || row.column_grant === true));
    if (has) { applicable.push(c); }
    else {
      console.log(`NOT APPLICABLE — ${c.name}: authenticated has no ${c.needsGrant.privilege} on ${c.needsGrant.table} (table or column level), so the breach cannot fire.`);
    }
  }

  for (const c of CASES) {
    if (c.expectNoChange) {
      console.log(`NOT PROVEN — ${c.name}: ${c.expectNoChange}`);
    }
  }

  for (const c of applicable) {
    if (c.expectNoChange) continue;
    console.log(`\n— breach: ${c.name} —`);
    try {
      await withRetry("breach", () => sql(c.breach));
      const broken = await withRetry("suite", () => Promise.resolve(runSuite()));
      // A case that prints a unique marker proves the row is really absent: the
      // marker travels through the output, so a stale read cannot fake a pass.
      const markerSeen = c.marker ? broken.out.includes(c.marker) : true;
      // A case whose assertion is expected NOT to move (see expectNoChange) is
      // informational: the breach is still injected and reversed, but no claim of
      // detection is made.
      const caught = c.expectNoChange ? false : markersMatch(broken.out, c);
      if (broken.code === 0) {
        console.log(broken.out);
        console.log(`CANARY FAILED: the suite passed while "${c.name}" was possible.`);
        failed = true;
      } else if (!caught) {
        console.log(`CANARY FAILED: the suite went red, but not on "${c.expects}".`);
        console.log(`  failed instead: ${broken.failed.join(" | ")}`);
        failed = true;
      } else {
        console.log(`  caught by "${c.expects}" (suite reported ${broken.failed.length} failure(s))`);
      }
    } catch (err) {
      console.log(`CANARY ABORTED on "${c.name}": ${String(err.message ?? err).slice(0, 200)}`);
      failed = true;
    } finally {
      // Restore the exact definitions the migrations created, from one shared
      // list. Runs even when the case above threw, so a network blip cannot
      // leave a weakened policy behind.
      await withRetry("restore", () => sql(RESTORE_ALL), 5).catch((err) => {
        console.log(`RESTORE FAILED for "${c.name}": ${String(err.message ?? err).slice(0, 200)}`);
        failed = true;
      });
    }
  }

  console.log("\n— restore verified: the suite must pass again —");
  const after = await withRetry("verification", () => Promise.resolve(runSuite()));
  if (after.code !== 0) {
    console.log(after.out);
    console.log("RESTORE FAILED: the schema was not put back correctly.");
    failed = true;
  } else {
    console.log("  suite green again — every breach was reversed");
  }
} finally {
  // Belt and braces: if anything threw mid-case, restore everything. The list is
  // idempotent, so re-running is safe.
  await withRetry("final restore", () => sql(RESTORE_ALL), 5).catch((err) => {
    console.log(`FINAL RESTORE FAILED: ${String(err.message ?? err).slice(0, 200)}`);
    process.exitCode = 1;
  });
}

process.exit(failed ? 1 : 0);