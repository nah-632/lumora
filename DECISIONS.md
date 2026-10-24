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
