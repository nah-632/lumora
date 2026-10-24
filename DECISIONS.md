# Decisions

## ADR-001 — Students are teacher-owned records with no student accounts
**Date:** 2026-10-24 · **Status:** APPROVED
**Context:** The master prompt's original v1 forbade storing student personal data.
The Product Owner overrode this: names, grade levels, grades and submissions are
now stored.
**Decision:** Each student belongs to exactly one teacher. There are no student
accounts, no student sign-in, and no student-facing access path.
**Consequences:** Guardians cannot access the data directly; a teacher is the sole
custodian. This must be reflected in the privacy policy and the legal review.

## ADR-002 — Isolation is enforced by composite foreign keys, not only by RLS
**Date:** 2026-10-24 · **Status:** APPROVED
**Context:** A policy can be edited by mistake; a constraint cannot be edited by a
query.
**Decision:** Every child table carries `teacher_id` and references its parent
through `(student_id, teacher_id) -> students(id, teacher_id)`.
**Consequences:** A cross-teacher link is a foreign-key violation, so the database
refuses it even if a future policy edit is wrong. Verified by the isolation suite.

## ADR-003 — No standing admin access to student data
**Date:** 2026-10-24 · **Status:** APPROVED
**Decision:** There is no admin RLS policy on any student table. Support reads one
student at a time through `admin_read_student()`, which requires the admin role
and a written reason (minimum 10 characters) and writes to `audit_logs`.
**Consequences:** Support is slower by design. Bulk reads are impossible without a
new, reviewed decision.

## ADR-004 — Arithmetic is deterministic and never delegated to the model
**Date:** 2026-10-24 · **Status:** APPROVED
**Decision:** Averages, deltas, counts and thresholds are computed in code. The
model receives finished figures and interprets them.
**Consequences:** A model error can produce a misleading sentence but never a wrong
number. `basisCount` is likewise computed in code, not taken from the model.

## ADR-005 — Privacy mode toggle (added by the implementer, not in the spec)
**Date:** 2026-10-24 · **Status:** APPROVED by Product Owner (keep)
**Context:** This feature was **not** part of the master prompt. It was added by
the implementer while building the roster, on the reasoning that students are
minors and a teacher may share their screen during a lesson or a meeting.
**Decision:** Keep it. A toggle replaces student names with a stable code derived
from the record id (`Student A3F1`), leaving everything else unchanged.
**Why kept:** It costs little, is off by default, and reduces accidental exposure
of a child's name on a projector or in a screen share.
**Risks:** A teacher could mistake the coded view for the real roster; the code is
stable per student, so a code could still be correlated with a position in a list.
**Rollback:** Remove the `privacy` state and the toggle in `StudentRoster.tsx`; no
data or API change is involved.

## ADR-006 — `basis_count` and `assessment_count` measure different things
**Date:** 2026-10-24 · **Status:** APPROVED
**Decision:** `assessment_count` is how many assessments were examined for the
subject. `basis_count` is how many distinct signals produced the alert (for
example a grade drop plus missing work = 2). Both are shown so the teacher can see
both the scale of the evidence and the reason the alert fired.

## ADR-007 — Server-side auth uses two clients, and the admin client is never in a request path
**Date:** 2026-10-24 · **Status:** APPROVED
**Decision:** `createSessionClient()` carries the caller's cookies so RLS applies.
`createAdminClient()` uses `service_role`, bypasses RLS, and is reserved for
account maintenance. Teacher-facing pages and API routes use only the session
client.
**Consequences:** The isolation suite sets up users with the admin API but asserts
exclusively with the teacher's own token.

## ADR-008 — `teacher_id` defaults to `auth.uid()`
**Date:** 2026-10-24 · **Status:** APPROVED
**Context:** Without a default, a client insert that omitted `teacher_id` failed the
INSERT policy. This was found by the isolation suite's positive control, not by
reading the SQL.
**Decision:** `teacher_id` defaults to `auth.uid()` on all student tables.
**Consequences:** Clients never send `teacher_id`. Forging another teacher's id is
still rejected by the policy.

## ADR-009 — Next.js 14 and React 18 are pinned deliberately
**Date:** 2026-10-24 · **Status:** APPROVED
**Context:** `npm audit` recommends Next 16 and React 19. Both are major upgrades.
**Decision:** Stay on Next 14.2.35 / React 18.3.1 until a planned migration.
**Why:**
- This device runs Next 14.2.35 / React 18.3.1 and cannot complete a full install
  of the Next 15 tree, so a local upgrade could not be verified before merging.
- `useActionState` is React 19-only; this codebase already ships a React 18
  equivalent (`src/lib/auth/useActionState.ts`). A React 19 upgrade is therefore
  a code migration, not a version bump.
- Next 15+ changes `cookies()`/`params` to async APIs across every page. That is a
  multi-day refactor that must be done with a working local build, which this
  environment cannot provide.
**Risk accepted:** the Next advisory below. See ADR-010 for the exposure analysis.
**Migration trigger:** when a CI-only workflow can validate the upgrade, or when a
Next advisory becomes exploitable in this configuration.
**Rollback:** none needed; this is the current state.

## ADR-010 — npm audit findings: what is actually exploitable
**Date:** 2026-10-24 · **Status:** RECORDED
`npm audit` against the real registry reports **13 advisories: 1 critical, 5 high,
5 moderate, 2 low**. Assessed one by one rather than counted:

| Package | Sev | Exploitable here? | Reasoning |
|---|---|---|---|
| next | critical | **Not in this configuration** | Advisories concern the Image Optimizer with remote `remotePatterns`, RSC deserialization, and rewrite smuggling. No `remotePatterns` are configured, no rewrites exist, and the app is not self-hosted on a public Node server yet. Must be re-assessed before deployment. |
| zod | high | **No** | Advisory requires validating oversized *constrained collections*. The only `z.array()` in the codebase is bounded with `.max(200)`, which is the documented mitigation. |
| postcss | high | **No** | Present only as a transitive build-time dependency of Next. It does not process untrusted input at runtime. |
| glob | high | **No** | CLI command-injection advisory; `glob` is a build-time transitive dependency and its CLI is never invoked. |
| @next/eslint-plugin-next, eslint-config-next | high | **No** | Lint-time only; never shipped. |
| esbuild | moderate | **No** | Dev-server advisory; esbuild is used only to transpile test fixtures, never to serve requests. |
| next-intl | moderate | **No** | Open-redirect and precompile advisories. Redirect targets are built from validated locale values (`ar`/`en`), never from user input; `experimental.messages.precompile` is not used. |
| tailwindcss / postcss-nested / postcss-selector-parser | moderate | **No** | Build-time only. |
| @supabase/auth-js | low | **No** | Malformed-path routing; the client is used server-side with fixed paths. |

**Conclusion:** no advisory is currently exploitable in this configuration. This is
an assessment, not a guarantee, and it must be revisited before any public
deployment. The reproducible blocker is recorded in ADR-011.

## ADR-011 — Legal review status
**Date:** 2026-10-24 · **Status:** CONFIRMED BY PRODUCT OWNER
The Product Owner has confirmed that **the legal review is complete and approved**.
The legal review is therefore removed from the blockers list.
**Consequence:** this removes a process blocker. It does **not** constitute a
compliance claim by the engineering team, and the privacy policy must still state
the real hosting region and the AI sub-processor before launch.
**Blocker list now:** separate staging/production Supabase projects, and rate
limiting on alert generation.

## ADR-012 — Branch protection
**Date:** 2026-10-24 · **Status:** PENDING OWNER ACTION
Both CI jobs (`Type-check, lint, tests, build` and `RLS isolation`) must be
required checks on `main` before this branch becomes `main`.

## ADR-012 — RLS policy enforcement on the INSERT path (measured, unresolved)
**Date:** 2026-10-25 · **Status:** OPEN — needs owner decision

While hardening the isolation suite we measured behaviour that the migrations
assume but do not guarantee:

1. **Omitted `teacher_id` bypasses the INSERT policy on this stack.** With
   `teacher_id default auth.uid()`, a signed-in client that leaves the column out
   of the request gets `201` while a client that sends `teacher_id: null` gets
   `42501`. Under the same conditions the explicit attack (`teacher_id = B`)
   returns `42501`. The row that lands is owned by the attacker, so no session
   crosses the account boundary — but the policy was not consulted for the
   defaulted value.
2. **The same SQL refuses it inside a role-switched function** (`23503`, because
   `auth.uid()` is not evaluated the same way there). The behaviour therefore
   depends on where the INSERT is executed, which is exactly why it cannot be
   treated as settled.
3. **Permission stage can mask the policy stage.** `authenticated` holds no
   `INSERT` privilege on `student_grades` (only column-level grants on the alert
   flags), so a permissive policy on that table is never reached. When the insert
   is serviced with a role that holds the privilege, the same permissive policy
   **does** write a foreign row (measured 201; refused 403 under the real policy).

**Proposed fix (not applied):** move the owner assignment out of the column
default into a `BEFORE INSERT` trigger that sets `teacher_id := auth.uid()` when
null, and `ALTER TABLE … ALTER COLUMN teacher_id DROP DEFAULT`. In the prototype
run the policy then saw the final value. This is a schema change across six
tables and a column-default contract change, so it is proposed, not made.

**Consequences today:** the canary marks four assertions as *not demonstrated*
(UPDATE under a permissive SELECT, DELETE×2 on tables with no DELETE grant, and
the explicit INSERT attack). The suite still proves them empirically on every run;
what is missing is proof that they can fail. `tests/security/open-cases.mjs`
prints the current table.

## ADR-013 — npm audit triage by surface, and the Next 15 upgrade plan
**Date:** 2026-10-25 · **Status:** PROPOSED — upgrade is a pre-launch blocker

`npm audit --registry=https://registry.npmjs.org` (this device's default registry
mirror does not implement the audit endpoint) reports 13 advisories: 1 critical,
5 high, 5 moderate, 2 low. Thirteen, because several advisories sit behind one
package version; the critical `next` finding alone carries 24 advisory entries.

| Advisory | CVE | Severity | Middleware | Server Actions | Auth | Cookies |
|---|---|---|---|---|---|---|
| GHSA-9g9p-9gw9-jx7f (Image Optimizer remotePatterns DoS) | CVE-2025-59471 | moderate* | no | no | no | no |
| GHSA-h25m-26qc-wcjf (RSC request deserialization DoS) | — | high | no | **yes** (RSC endpoint) | no | no |
| GHSA-8h8q-6873-q5fj (RSC DoS) | — | high | no | **yes** (RSC endpoint) | no | no |
| GHSA-q4gf-8mx6-v5v3 (RSC DoS) | — | high | no | **yes** (RSC endpoint) | no | no |
| GHSA-mrhx-c7xc-m3w5 (zod unbounded array) | CVE-2023-54404 | high | no | no | no | no |
| GHSA-5j98-mcp5-4vw2 (glob CLI command injection) | CVE-2025-64756 | high | no | no | no | no |
| GHSA-qx2v-qp2m-jg93 / -6g55 / -fxqj / -r28c (postcss) | — | high | no | no | no | no |
| GHSA-3g8h-86w9-wvmq (Middleware redirect cache poisoning) | — | moderate | **yes** | no | no | no |
| GHSA-36qx-fr4f-26g5 (Middleware bypass, Pages Router i18n) | — | moderate | **yes** | no | no | no |
| GHSA-955p-x3mx-jcvp (Server Function endpoint disclosure) | — | moderate | no | **yes** | borderline | no |
| GHSA-8f24-v5vv-gm5j (next-intl open redirect) | CVE-2026-40299 | moderate | no | no | no | no |
| GHSA-8r88-6cj9-9fh5 (@supabase/auth-js path routing) | — | low | no | no | borderline | no |

\* `npm audit` reports `next` as critical as a package; this individual advisory
is rated moderate by the publisher. The table follows the publisher.

**Why they are not exploitable today, judged per surface:**
- *Middleware:* the jobs use `createServerClient` only to refresh the session
  cookie; locale routing is hand-written. `next-intl`'s middleware is not used at
  all (`createMiddleware` appears nowhere), so CVE-2026-40299 cannot fire — but
  the dependency is still flagged.
- *Server Actions:* two auth actions exist. The RSC deserialization advisories
  are availability issues (CPU), not confidentiality; there is no public bucket
  and no unauthenticated Server Function that returns data.
- *Auth/Cookies:* sessions are httpOnly cookies set by `@supabase/ssr`; no
  token is read from a query string.
- *zod:* the only `z.array` is `.max(200)`; every other schema is an object of
  bounded strings. The advisory needs an unbounded array.
- *postcss/glob:* build-time only; neither runs at request time.

**Upgrade plan — `chore/nextjs-15-upgrade`, separate branch, blocked until then:**
1. Pin the target to a patched 15.5.x (`>= 15.5.16`) — the RSC advisories are
   fixed at 15.5.15/15.5.16 and the Image Optimizer at 15.5.14.
2. React 19 alongside it; `useActionState` replaces `src/lib/react/useActionState.ts`
   (written for React 18, delete it).
3. `cookies()`, `params` and `searchParams` become async — every page passes
   `params: Promise<…>` already, so this is mostly mechanical.
4. `next-intl` 3 → 4 (peer range excludes 14-only setups and the open redirect is
   fixed in 4.9.1). The middleware does not use `next-intl`, so the risk is
   confined to `getTranslations`.
5. Re-run: type-check, lint, 27 unit tests, isolation (24 assertions + 1 xfail),
   evidence (11), canary (7 injectable cases), build in CI.
6. Roll back = revert the branch; nothing in `supabase/` changes for this upgrade.

`npm audit` is now part of every phase report, run against the public registry.
