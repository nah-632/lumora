-- 0012_alert_basis_kind.sql — what an alert's basis count actually counts
--
-- Correction of 0011. There, basis_count stored the number of distinct *signals*
-- behind an alert. That was wrong: the product statement is "Based on N
-- assessments" / "Based on N submissions", so the count is the number of source
-- records the alert rests on.
--
-- Two changes, in order:
--   1. add basis_kind ('assessments' | 'submissions') — a null kind means the
--      count is unknown and no "Based on…" line is rendered at all;
--   2. null out the old signal-count values rather than leave numbers that would
--      now be read as a record count. No data is lost that the alert text did not
--      already carry, and the alternative — keeping a number that means something
--      different from its own column — is exactly the kind of quiet lie this
--      table exists to prevent.
--
-- The count itself is never written by a client and never taken from the model:
-- it is computed in src/features/students/lib/alert-basis.ts from the source rows.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'alert_basis_kind') then
    create type public.alert_basis_kind as enum ('assessments', 'submissions');
  end if;
end
$$;

alter table public.student_alerts
  add column if not exists basis_kind public.alert_basis_kind;

comment on column public.student_alerts.basis_kind is
  'Which source records basis_count counts. NULL = unknown; the UI renders no "Based on" line.';

comment on column public.student_alerts.basis_count is
  'How many assessment/submission records the alert is based on, per basis_kind. Computed server-side.';

-- The pair must agree: a count without a kind is unreadable, and a kind without
-- a count is incomplete. Both-or-neither is enforced on the table itself so the
-- rule cannot be lost by a future code path forgetting to set one of them.
alter table public.student_alerts
  drop constraint if exists student_alerts_basis_pair;
alter table public.student_alerts
  add constraint student_alerts_basis_pair
  check ((basis_count is null) = (basis_kind is null));

-- Reset the legacy signal counts (see the header for why this is a reset and
-- not a translation).
update public.student_alerts
   set basis_count = null,
       basis_kind  = null
 where basis_count is not null;

-- Writers: service_role (server-side generation) may set both columns; the
-- client grant from 0010 is unchanged, so a teacher still cannot write them.
-- Nothing to grant here — service_role already holds table-wide UPDATE.

comment on constraint student_alerts_basis_pair on public.student_alerts is
  'basis_count and basis_kind are set together or not at all.';
-- ---------------------------------------------------------------------------
-- evidence_ids — the exact source records the alert rests on
--
-- A count is a claim; a list of ids is a claim that can be checked. Nothing is
-- enforced by foreign keys here on purpose: a purged student removes its source
-- rows, and the alert row disappears with the student anyway. The ids exist so a
-- verification job (and the test suite) can prove that the records named really
-- do carry the numbers in the alert, rather than trusting a stored integer.
-- ---------------------------------------------------------------------------
alter table public.student_alerts
  add column if not exists evidence_ids uuid[];

comment on column public.student_alerts.evidence_ids is
  'Source rows (student_grades / student_submissions ids) the alert was computed from.';

-- The client still cannot write it: 0010 grants column-level write only on
-- is_read, snoozed_until, dismissed_at and dismissed_reason.
-- ---------------------------------------------------------------------------
-- student_submissions.subject — so a missing assignment counts for a subject
--
-- "Based on N submissions" is only accurate if the submissions belong to the
-- subject the alert names. Without this column the generator attributed every
-- missing assignment to every subject, which is a wrong number in the sentence,
-- not a cosmetic issue.
--
-- Nullable on purpose: existing rows have no subject, and a submission whose
-- subject is unknown is counted for the student but never charged to one subject.
-- ---------------------------------------------------------------------------
alter table public.student_submissions
  add column if not exists subject text
  check (subject is null or char_length(btrim(subject)) between 1 and 80);

comment on column public.student_submissions.subject is
  'Subject this assignment belongs to. NULL = unknown; never attributed to a subject.';

create index if not exists student_submissions_subject_idx
  on public.student_submissions (student_id, subject, status);

-- Column-level writes are unchanged: 0010 grants insert/update on the table to
-- authenticated, and RLS still restricts every row to its owner.
