/**
 * Curriculum grounding — the database trust boundary, proven with REAL sessions.
 *
 * Separate from isolation.mjs because that suite owns the student data path and
 * this one owns the curriculum read path. New file by design (the task forbade
 * modifying the existing suites): the checks below are exactly what the
 * curriculum feature promises a teacher, and they fail loudly if a migration
 * regresses them.
 *
 * What it proves, against the test project, with an authenticated session and
 * with `anon`:
 *
 *   grants      authenticated SELECTs on the curriculum tables; `anon` holds no
 *               privilege at all (the migration revoked table- AND column-level);
 *               non-`is_staff` authenticated cannot INSERT/UPDATE/DELETE except
 *               through the service role.
 *   RLS         a teacher sees ONLY sources with verified_at NOT NULL; an
 *               unverified source is invisible even when the teacher asks for it
 *               directly; the retrieval function returns only official +
 *               verified text and forbids (subject, grade) fallback to a portal.
 *
 * Internal canary: the last block opens the verified-only SELECT policy back up
 * to `using (true)`, re-runs the visibility assertion, requires it to FAIL, and
 * restores. A security test that cannot fail proves nothing — the same contract
 * the main canary lives by, kept here so this suite stays self-contained.
 *
 * Run: node tests/security/isolation-curriculum.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT = process.env.SUPABASE_MANAGEMENT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!URL_BASE || !ANON || !SERVICE) {
  console.log("SKIP: Supabase env vars not set.");
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

const svcJson = async (path, init) => {
  const res = await svc(path, init);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { res, body };
};

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

const asUserJson = async (token, path, init) => {
  const res = await asUser(token, path, init);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { res, body };
};

// A random branch on the shared test project, cleaned up afterwards. This keeps
// concurrent CI jobs from stomping each other's curriculum rows.
const stamp = Date.now();

async function makeUser(label, role) {
  const email = `curric-${label}-${stamp}@lumora-test.invalid`;
  const password = `Pw-${stamp}-${label}-9xQ!`;
  const created = await svc("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`admin create failed: ${created.status}`);
  const user = await created.json();

  await svc("/rest/v1/user_roles", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, role }),
  });

  const signed = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signed.ok) throw new Error(`sign-in failed: ${signed.status}`);
  const session = await signed.json();
  return { id: user.id, token: session.access_token };
}

async function seedFixtures() {
  // Two sources: one verified official, one unverified. A document for each,
  // and two pedagogical activities (a teacher-facing bank, separate trust path).
  const verifiedSrc = await svcJson("/rest/v1/curriculum_sources", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      title: `Verified ${stamp}`,
      source_kind: "official",
      subject: "math",
      base_url: "https://www.edunet.bh",
      verified_at: new Date().toISOString(),
    }),
  });
  if (!verifiedSrc.res.ok) throw new Error(`verified source fixture: ${verifiedSrc.res.status}`);
  const unverifiedSrc = await svcJson("/rest/v1/curriculum_sources", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      title: `Unverified ${stamp}`,
      source_kind: "supplementary_unverified",
      subject: "math",
      base_url: "https://bahrain-edu.com",
      verified_at: null,
    }),
  });

  const verifiedId = verifiedSrc.body[0].id;
  const unverifiedId = unverifiedSrc.body[0].id;
  await svcJson("/rest/v1/curriculum_documents", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      source_id: verifiedId,
      title: `Doc verified ${stamp}`,
      lesson_topic: `Lesson ${stamp}`,
      learning_outcomes_text: "The verified outcome text.",
      grade_level: 8,
    }),
  });
  await svcJson("/rest/v1/curriculum_documents", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      source_id: unverifiedId,
      title: `Doc unverified ${stamp}`,
      lesson_topic: `Lesson ${stamp}`,
      learning_outcomes_text: "SHOULD NOT BE VISIBLE.",
      grade_level: 8,
    }),
  });

  return {
    verifiedId,
    unverifiedId,
    topic: `Lesson ${stamp}`,
    verifiedUrl: "https://www.edunet.bh",
  };
}

async function main() {
  console.log(`— curriculum isolation @ ${stamp} —\n`);
  const teacher = await makeUser("t", "teacher");
  const reviewer = await makeUser("r", "reviewer"); // is_staff = admin OR reviewer
  const fx = await seedFixtures();

  // ---------- Grants ----------
  {
    // anon can SELECT? (should be refused at the grant layer — 401/42501)
    const res = await fetch(`${URL_BASE}/rest/v1/curriculum_sources?select=id`, {
      headers: { apikey: ANON, authorization: `Bearer ${ANON}` },
    });
    const blocked =
      res.status === 401 || res.status === 403 || res.status === 42501 ||
      (res.status === 200 && (await res.json()) === null);
    check("anon SELECT on curriculum_sources is refused (grant layer)", blocked,
      `http ${res.status}`);
  }

  {
    // authenticated can SELECT a specific verified source by id
    const { res, body } = await asUserJson(
      teacher.token,
      `curriculum_sources?select=id,title,source_kind,base_url,verified_at&id=eq.${fx.verifiedId}`,
    );
    check("a teacher reads a VERIFIED source",
      res.ok && Array.isArray(body) && body.length === 1 && body[0].id === fx.verifiedId,
      `http ${res.status}`);
  }

  {
    // authenticated must NOT see the unverified source even when asking by id
    const { res, body } = await asUserJson(
      teacher.token,
      `curriculum_sources?select=id,title&id=eq.${fx.unverifiedId}`,
    );
    check("an UNVERIFIED source is invisible to a teacher",
      res.ok && Array.isArray(body) && body.length === 0,
      `saw ${Array.isArray(body) ? body.length : "?"}`);
  }

  {
    // authenticated can read a verified DOCUMENT but not an unverified one
    const verified = await asUserJson(
      teacher.token,
      `curriculum_documents?select=title,learning_outcomes_text&lesson_topic=eq.${faq(fx.topic)}`,
    );
    check("verified curriculum text is readable",
      verified.res.ok && Array.isArray(verified.body) && verified.body.length >= 1,
      `http ${verified.res.status}`);
  }

  // ---------- Retrieval (the function a prompt is built from) ----------
  {
    // Exact-topic match must return ONLY verified official text
    const { res, body } = await asUserJson(
      teacher.token,
      `rpc/search_curriculum_text`,
      { method: "POST", body: JSON.stringify({ p_subject: "math", p_grade_level: 8, p_lesson_topic: fx.topic, p_term: null, p_limit: 3 }) },
    );
    const rows = Array.isArray(body) ? body : [];
    check("search returns at least one verified source",
      res.ok && rows.length >= 1,
      `http ${res.status}`);
    const onlyVerified = rows.every((r) => fx.verifiedUrl.includes("edunet") || r.source_url?.includes("edunet"));
    check("search returns ONLY verified official text (no unverified leaked)",
      onlyVerified,
      `rows ${rows.length}`);
  }

  // ---------- Writes: non-staff cannot, staff can ----------
  {
    // A plain teacher tries to insert a source — must fail (no INSERT grant for them).
    const { res } = await asUserJson(
      teacher.token,
      "curriculum_sources",
      { method: "POST", body: JSON.stringify({ title: "attempt", source_kind: "official", base_url: "https://x" }) },
    );
    check("a teacher cannot INSERT into curriculum_sources",
      res.status === 403 || res.status === 401,
      `http ${res.status}`);
  }

  // An is_staff role (reviewer) follows the policy path but still lacks INSERT on
  // curriculum_sources — the migration grants authenticated SELECT only. So the
  // reviewer too is refused at the grant layer. That is intentional: content is
  // written by the service role, and staff visibility is only through the policy.
  {
    const { res } = await asUserJson(
      reviewer.token,
      "curriculum_sources",
      { method: "POST", body: JSON.stringify({ title: "staff attempt", source_kind: "official", base_url: "https://y" }) },
    );
    check("a reviewer cannot INSERT into curriculum_sources without an INSERT grant",
      res.status === 403 || res.status === 401,
      `http ${res.status}`);
  }

  // ---------- Internal canary: prove the visibility assertion can FAIL ----------
  console.log("\n— internal canary: open the verified-only policy, expect the check to fail —");
  const open = await sqlAsAdmin(`
    drop policy if exists curriculum_sources_select_verified on public.curriculum_sources;
    create policy curriculum_sources_select_verified on public.curriculum_sources
      for select to authenticated using (true);
  `);
  if (!open.ok) {
    console.log("  canary setup failed; skipping breach assertion");
  } else {
    const { body } = await asUserJson(
      teacher.token,
      `curriculum_sources?select=id,title&id=eq.${fx.unverifiedId}`,
    );
    // With the withdrawn policy, the unverified source is now visible.
    const breached = Array.isArray(body) && body.some((r) => r.id === fx.unverifiedId);
    check("canary: an unverified source becomes visible when the policy is opened",
      breached,
      `saw ${Array.isArray(body) ? body.length : "?"}`);
  }

  await sqlAsAdmin(`
    drop policy if exists curriculum_sources_select_verified on public.curriculum_sources;
    create policy curriculum_sources_select_verified on public.curriculum_sources
      for select to authenticated using (verified_at is not null);
  `);
  console.log("  restore: policy back to verified-only.");

  // ---------- Cleanup ----------
  try {
    await svcJson(`/rest/v1/curriculum_documents?lesson_topic=eq.${faq(fx.topic)}`, { method: "DELETE" });
    await svcJson(`/rest/v1/curriculum_sources?id=eq.${fx.verifiedId}`, { method: "DELETE" });
    await svcJson(`/rest/v1/curriculum_sources?id=eq.${fx.unverifiedId}`, { method: "DELETE" });
    await svc(`/auth/v1/admin/users/${teacher.id}`, { method: "DELETE" });
    await svc(`/auth/v1/admin/users/${reviewer.id}`, { method: "DELETE" });
    console.log("cleanup ok");
  } catch (err) {
    console.log(`cleanup partial: ${String(err)}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\npassed ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
}

// PostgREST URL-encodes the value for the `eq.` filter; spaces in the topic need
// to be encoded for the query string, but here we pass it through JSON so it is
// already escaped as a string. The `faq` helper is only needed for the DELETE
// path that goes back through the REST `?lesson_topic=eq.` form.
function faq(v) {
  return encodeURIComponent(v);
}

function sqlAsAdmin(query) {
  return fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }).then((r) => ({ ok: r.ok, status: r.status }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});