/**
 * Re-applies the canonical policies, then shows what is actually in the database.
 *
 * The hard-coded definitions come from migrations 0010/0011 (see policies.mjs);
 * the catalogue read afterwards is the evidence that they landed — this prints
 * the live definitions so a person can see the restored state, not take a log's
 * word for it.
 */
import { RESTORE_ALL } from "./policies.mjs";
import { query, readPolicies } from "./snapshot-lib.mjs";

if (!process.env.SUPABASE_MANAGEMENT_TOKEN || !process.env.SUPABASE_PROJECT_REF) {
  console.error("SKIP: SUPABASE_MANAGEMENT_TOKEN / SUPABASE_PROJECT_REF not set.");
  process.exit(3);
}

await query(RESTORE_ALL);
const rows = await readPolicies();
for (const r of rows) {
  console.log(`${r.tablename}.${r.policyname} [${r.cmd}] ${r.qual ?? ""}${r.with_check ? ` WITH CHECK ${r.with_check}` : ""}`);
}
console.log(`\n${rows.length} policies in place.`);
