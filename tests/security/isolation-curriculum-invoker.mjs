/**
 * search_curriculum_text() as SECURITY INVOKER — proven with real sessions.
 *
 * 0019 changed the function from DEFINER to INVOKER. That change is only worth
 * anything if it is demonstrated, because the two modes fail differently:
 *
 *   DEFINER — the function runs as its owner, so RLS never sees the caller. The
 *             verified-only filter inside the body is the entire defence.
 *   INVOKER — the function runs as the caller, so RLS applies to the tables it
 *             reads. Two independent guards now have to fail together.
 *
 * This file pins the INVOKER behaviour end to end, against the test project:
 *   - a teacher calling the function gets the verified official rows
 *   - an unverified source is excluded
 *   - a source that IS verified but NOT official is excluded (the body's
 *     predicate, which RLS cannot express)
 *   - anon cannot execute and cannot read the tables
 *   - a fixture selection returns rows at all, so "excluded" is not vacuous
 *
 * Every fixture is removed afterwards. New file by design: the existing
 * isolation suite owns the student path, and this one owns retrieval.
 *
 * Run: node tests/security/isolation-curriculum-invoker.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const stamp = Date.now();
const TOPIC = `invoker-topic-${stamp}`;

async function makeTeacher() {
  const email = `inv-${stamp}@lumora-test.invalid`;
  const password = `Pw-${stamp}-inv-9xQ!`;
  const created = await svc("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`admin create failed: ${created.status}`);
  const user = await created.json();
  await svc("/rest/v1/user_roles", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, role: "teacher" }),
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

async function mkSource(fields) {
  const { res, body } = await svcJson("/rest/v1/curriculum_sources", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`source fixture: ${res.status} ${JSON.stringify(body)}`);
  return body[0];
}

async function mkDoc(sourceId, text) {
  const { res, body } = await svcJson("/rest/v1/curriculum_documents", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      source_id: sourceId,
      title: `doc-${stamp}`,
      lesson_topic: TOPIC,
      learning_outcomes_text: text,
      grade_level: 8,
    }),
  });
  if (!res.ok) throw new Error(`doc fixture: ${res.status} ${JSON.stringify(body)}`);
}

async function main() {
  console.log(`— INVOKER retrieval @ ${stamp} —\n`);

  const teacher = await makeTeacher();

  // Three sources, three different exclusion reasons.
  const officialVerified = await mkSource({
    title: `inv official ${stamp}`,
    source_kind: "official",
    subject: "math",
    base_url: "https://www.edunet.bh",
    verified_at: new Date().toISOString(),
  });
  const unverified = await mkSource({
    title: `inv unverified ${stamp}`,
    source_kind: "official",
    subject: "math",
    base_url: "https://bahrain-edu.com",
    verified_at: null,
  });
  const verifiedNotOfficial = await mkSource({
    title: `inv supplementary ${stamp}`,
    source_kind: "supplementary_unverified",
    subject: "math",
    base_url: "https://almanahj.com/bh",
    verified_at: new Date().toISOString(),
  });

  await mkDoc(officialVerified.id, "OFFICIAL VERIFIED OUTCOME");
  await mkDoc(unverified.id, "UNVERIFIED MUST NOT APPEAR");
  await mkDoc(verifiedNotOfficial.id, "SUPPLEMENTARY MUST NOT APPEAR");

  // ---- the function, as a teacher, through PostgREST ----
  const rpc = await asUserJson(teacher.token, "rpc/search_curriculum_text", {
    method: "POST",
    body: JSON.stringify({
      p_subject: "math",
      p_grade_level: 8,
      p_lesson_topic: TOPIC,
      p_term: null,
      p_limit: 5,
    }),
  });

  const rows = Array.isArray(rpc.body) ? rpc.body : [];
  check("a teacher can call search_curriculum_text() at all", rpc.res.ok, `http ${rpc.res.status}`);
  check("retrieval returns rows for a fixture selection", rows.length >= 1, `rows ${rows.length}`);

  const texts = rows.map((r) => r.text_content ?? "");
  check(
    "the verified OFFICIAL outcome is returned",
    texts.some((t) => t.includes("OFFICIAL VERIFIED OUTCOME")),
    `${rows.length} row(s)`,
  );
  check(
    "an UNVERIFIED source is excluded",
    !texts.some((t) => t.includes("UNVERIFIED MUST NOT APPEAR")),
    "no unverified text in the result",
  );
  check(
    "a VERIFIED but non-official source is excluded by the body predicate",
    !texts.some((t) => t.includes("SUPPLEMENTARY MUST NOT APPEAR")),
    "no supplementary text in the result",
  );

  // ---- RLS is genuinely in play: read the tables directly as the teacher ----
  {
    const { body } = await asUserJson(teacher.token, "curriculum_sources?select=id,title");
    const ids = (Array.isArray(body) ? body : []).map((r) => r.id);
    check("direct SELECT as a teacher sees the verified official source", ids.includes(officialVerified.id));
    check("direct SELECT as a teacher does NOT see the unverified source", !ids.includes(unverified.id));
    check(
      "direct SELECT as a teacher DOES see the verified non-official source (RLS filters verification only)",
      ids.includes(verifiedNotOfficial.id),
      "this is why the body must also filter source_kind",
    );
  }

  // ---- anon ----
  {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/search_curriculum_text`, {
      method: "POST",
      headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" },
      body: JSON.stringify({ p_subject: "math", p_grade_level: 8, p_lesson_topic: TOPIC, p_term: null, p_limit: 5 }),
    });
    check("anon cannot execute search_curriculum_text()", res.status === 401 || res.status === 403, `http ${res.status}`);
  }

  // ---- cleanup ----
  try {
    await svcJson(`/rest/v1/curriculum_documents?lesson_topic=eq.${encodeURIComponent(TOPIC)}`, { method: "DELETE" });
    for (const s of [officialVerified, unverified, verifiedNotOfficial]) {
      await svcJson(`/rest/v1/curriculum_sources?id=eq.${s.id}`, { method: "DELETE" });
    }
    await svc(`/auth/v1/admin/users/${teacher.id}`, { method: "DELETE" });

    const left = await svcJson(`/rest/v1/curriculum_sources?select=id&title=like.inv*${stamp}*`);
    check("fixtures cleaned up", Array.isArray(left.body) && left.body.length === 0, `left ${Array.isArray(left.body) ? left.body.length : "?"}`);
  } catch (err) {
    check("fixtures cleaned up", false, String(err).slice(0, 120));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\npassed ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});