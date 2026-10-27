/** Prints the current RLS policy definitions for the student tables as JSON. */
import { readPolicies } from "./snapshot-lib.mjs";

if (!process.env.SUPABASE_MANAGEMENT_TOKEN || !process.env.SUPABASE_PROJECT_REF) {
  console.error("SKIP: SUPABASE_MANAGEMENT_TOKEN / SUPABASE_PROJECT_REF not set.");
  process.exit(3);
}
console.log(JSON.stringify(await readPolicies(), null, 2));
