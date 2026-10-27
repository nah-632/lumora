/**
 * Guard: the canary's restore SQL must match the migrations it is restoring.
 *
 * A restore that does not reproduce the original policy is worse than no canary:
 * it reports "schema restored" while quietly weakening the database. It happened
 * once — the first version dropped `deleted_at is null` from the students SELECT
 * policy, and the next run showed a soft-deleted student back in the roster.
 *
 * This test compares the restore statements in tests/security/policies.mjs with
 * the policy definitions in supabase/migrations, so a drift fails here rather
 * than in production. It runs with `node --test` and needs no database.
 *
 * Run: node --test tests/security/policies.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const { RESTORE_ALL } = await import("./policies.mjs");

const migrations = readdirSync(join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(ROOT, "supabase/migrations", f), "utf8"))
  .join("\n");

const normalise = (sql) =>
  sql
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .toLowerCase();

/** Every `create policy <name> on <table> ... ;` block, keyed by name. */
function policiesFrom(sql) {
  const out = new Map();
  const re = /create policy\s+(\w+)\s+on\s+[\w.]+\s+([\s\S]*?);/g;
  let m;
  while ((m = re.exec(sql))) {
    out.set(m[1], normalise(`create policy ${m[1]} on t ${m[2]};`));
  }
  return out;
}

const migrationPolicies = policiesFrom(migrations);
const restorePolicies = policiesFrom(RESTORE_ALL);

test("every policy the restore recreates exists in a migration", () => {
  for (const name of restorePolicies.keys()) {
    if (name.startsWith("canary_")) continue; // temporary; dropped on restore
    assert.ok(migrationPolicies.has(name), `${name} is recreated by the restore but is not in any migration`);
  }
});

test("each restored policy is byte-identical in substance to its migration definition", () => {
  for (const [name, body] of restorePolicies) {
    if (name.startsWith("canary_")) continue;
    assert.equal(body, migrationPolicies.get(name), `restore of ${name} drifted from the migration`);
  }
});

test("the students SELECT policy still hides soft-deleted rows", () => {
  const select = restorePolicies.get("students_select_own");
  assert.ok(select, "students_select_own missing from the restore");
  assert.match(select, /deleted_at is null/, "a soft-deleted student would reappear in the roster");
});

test("no temporary canary policy or grant survives the restore", () => {
  for (const name of restorePolicies.keys()) {
    assert.ok(!name.startsWith("canary_") || /drop policy if exists canary_/.test(RESTORE_ALL),
      "canary policies must be dropped");
  }
  // DELETE on the alert trail must be revoked, not granted.
  assert.match(RESTORE_ALL, /revoke delete on public\.student_alerts from authenticated/);
  assert.doesNotMatch(RESTORE_ALL.replace(/revoke delete[^;]*;/g, ""), /grant delete/i,
    "the restore must never grant DELETE");
});