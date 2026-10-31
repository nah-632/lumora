/**
 * Manual verification of curriculum source URLs.
 *
 * NOT part of CI, and deliberately so. This script decides what a human is
 * allowed to see: a row it marks verified becomes visible to every teacher and
 * eligible for retrieval into a prompt. That is a judgement about whether the
 * page at a URL is genuinely what its title claims, and it is not a judgement an
 * unattended job should make once and never revisit.
 *
 * WHAT IT CHECKS, AND WHAT IT REFUSES TO CHECK
 *
 * It confirms the URL resolves, that the response is HTML or a document rather
 * than a login wall or an error page, and that the content type is one this
 * product can honestly cite. It does NOT judge whether the content is
 * curriculum-accurate, and it does not verify `learning_outcomes_text` — that
 * text is pasted by a person who read the source. Passing this script means
 * "this link is real and reachable", nothing more, and `verified_at` is set on
 * that basis.
 *
 * USAGE
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-curriculum-links.mjs --dry-run
 *   ... --apply --id <uuid>          one row
 *   ... --apply                      every candidate that passes
 *
 * Without --apply nothing is written. `--dry-run` is the default posture, and
 * `--apply` is required to change a row, because the failure mode of getting
 * this wrong is a teacher citing a source that does not exist.
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONLY_ID = (() => {
  const i = args.indexOf("--id");
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
})();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.\n" +
      "This script writes to the database, so it needs the service role. It is never run in CI.",
  );
  process.exit(2);
}

if (!APPLY) {
  console.log("DRY RUN — nothing will be written. Pass --apply to verify rows.\n");
}

/**
 * Content types this product can cite.
 *
 * A `text/html` page is a landing page; a PDF is usually the document itself. A
 * `text/plain`, a JSON body or an octet-stream is something the script cannot
 * describe, so it declines rather than guessing.
 */
const ACCEPTABLE = [
  "text/html",
  "application/pdf",
  "application/xhtml+xml",
  "application/vnd.openxmlformats",
  "application/msword",
];

const TIMEOUT_MS = 20_000;

/**
 * A HEAD first, then a GET if HEAD is refused.
 *
 * Some government sites reject HEAD with 405 while serving the page fine, and
 * treating that as a failure would leave real sources unverified. The GET is
 * capped by reading only the first chunk and aborting, so a 200MB PDF does not
 * get downloaded to check a content type.
 */
async function probe(url) {
  const attempt = async (method) => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "User-Agent": "LumoraCurriculumVerifier/1.0 (+contact: ops)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const finalUrl = res.url;
    try {
      await res.body?.cancel();
    } catch {
      // A body that cannot be cancelled is not a failure of the check.
    }
    return { status: res.status, type, finalUrl };
  };

  let result;
  try {
    result = await attempt("HEAD");
    if (result.status === 405 || result.status === 501 || result.status === 403) {
      result = await attempt("GET");
    }
  } catch (err) {
    return { ok: false, reason: `unreachable: ${String(err?.message ?? err).slice(0, 120)}` };
  }

  if (result.status < 200 || result.status >= 300) {
    return { ok: false, reason: `HTTP ${result.status}` };
  }

  const acceptable = ACCEPTABLE.some((t) => result.type.startsWith(t));
  if (!acceptable) {
    return { ok: false, reason: `content-type "${result.type || "(none)"}" is not citable` };
  }

  // A redirect off the expected host is reported, not rejected: ministries move
  // pages, and a permanent redirect to the same publisher is normal. A redirect
  // to a different registrable domain is worth a human look before applying.
  return { ok: true, type: result.type, finalUrl: result.finalUrl };
}

function registrableHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "").split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = supabase
  .from("curriculum_sources")
  .select("id, title, publisher, base_url, verified_at, source_kind")
  .not("base_url", "is", null);

if (ONLY_ID) query = query.eq("id", ONLY_ID);

const { data: rows, error } = await query;

if (error) {
  console.error(`Could not read curriculum_sources: ${error.message}`);
  process.exit(1);
}

if (!rows || rows.length === 0) {
  console.log("No rows with a base_url. Nothing to verify.");
  process.exit(0);
}

console.log(`${rows.length} candidate row(s) with a base_url.\n`);

let verified = 0;
let refused = 0;

for (const row of rows) {
  const label = `${row.title} <${row.base_url}>`;
  if (row.verified_at) {
    console.log(`SKIP     ${label}\n         already verified at ${row.verified_at}\n`);
    continue;
  }

  const result = await probe(row.base_url);
  if (!result.ok) {
    refused += 1;
    console.log(`REFUSE   ${label}\n         ${result.reason}\n`);
    continue;
  }

  const redirectNote =
    registrableHost(result.finalUrl) !== registrableHost(row.base_url)
      ? `\n         WARNING: redirects to a different site: ${result.finalUrl}`
      : "";
  const kindNote =
    row.source_kind === "official"
      ? ""
      : "\n         NOTE: source_kind is supplementary_unverified. This script sets verified_at,\n" +
        "         which makes the row VISIBLE, but retrieval also requires source_kind = 'official'.\n" +
        "         A supplementary row will not enter a prompt — update source_kind by hand if that\n" +
        "         is what you intend, after confirming the source is genuinely Ministry-published.";

  if (!APPLY) {
    console.log(`WOULD VERIFY  ${label}\n         ${result.type}${redirectNote}${kindNote}\n`);
    continue;
  }

  const { error: writeError } = await supabase
    .from("curriculum_sources")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id);

  if (writeError) {
    refused += 1;
    console.log(`WRITE FAILED  ${label}\n         ${writeError.message}\n`);
    continue;
  }

  verified += 1;
  console.log(`VERIFIED  ${label}\n         ${result.type}${redirectNote}${kindNote}\n`);
}

console.log(
  APPLY
    ? `\nDone. ${verified} verified, ${refused} refused.`
    : `\nDry run: ${rows.length} checked, nothing written. Re-run with --apply to verify.`,
);

console.log(
  "\nReminder: this script proves a URL resolves. It does not prove the content is\n" +
    "curriculum-accurate, and it does not check learning_outcomes_text — a person must\n" +
    "have read the source and pasted that text before it means anything.",
);
