-- 0011_phase_c.sql — interventions, per-teacher alert settings, basis_count
--
-- Follows the same isolation model as 0010: every table carries teacher_id and
-- links through the composite key (student_id, teacher_id) where a student is
-- involved, so a cross-teacher link is a constraint violation.

-- ---------------------------------------------------------------------------
-- teacher_alert_settings — one row per teacher, created on first write
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_alert_settings (
  teacher_id uuid primary key references auth.users (id) on delete cascade,
  /** Percentage-point drop that counts as notable. Spec default is 20. */
  drop_threshold_pct integer not null default 20
    check (drop_threshold_pct between 1 and 100),
  /** Reserved: whether missing-work alerts are wanted at all. */
  missing_work_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.teacher_alert_settings is
  'Per-teacher alert sensitivity. Absence of a row means the defaults apply.';

alter table public.teacher_alert_settings enable row level security;
revoke all on public.teacher_alert_settings from anon, authenticated;

drop policy if exists teacher_alert_settings_select_own on public.teacher_alert_settings;
create policy teacher_alert_settings_select_own on public.teacher_alert_settings
  for select to authenticated using (teacher_id = (select auth.uid()));

drop policy if exists teacher_alert_settings_insert_own on public.teacher_alert_settings;
create policy teacher_alert_settings_insert_own on public.teacher_alert_settings
  for insert to authenticated with check (teacher_id = (select auth.uid()));

drop policy if exists teacher_alert_settings_update_own on public.teacher_alert_settings;
create policy teacher_alert_settings_update_own on public.teacher_alert_settings
  for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

grant select, insert on public.teacher_alert_settings to authenticated;
-- Column-level: teacher_id and updated_at are not writable by the client.
grant update (drop_threshold_pct, missing_work_alerts) on public.teacher_alert_settings to authenticated;

drop trigger if exists teacher_alert_settings_touch on public.teacher_alert_settings;
create trigger teacher_alert_settings_touch
  before update on public.teacher_alert_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- student_interventions — what the teacher actually did
--
-- Deliberately descriptive rather than prescriptive: it records the action the
-- teacher chose so a later before/after comparison is possible. It never
-- suggests, scores or judges.
-- ---------------------------------------------------------------------------
create table if not exists public.student_interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  /** Free text describing what the teacher did. */
  action text not null check (char_length(btrim(action)) between 3 and 1000),
  /** Optional link to the alert that prompted it. */
  alert_id uuid references public.student_alerts (id) on delete set null,
  /** Optional subject the intervention focused on. */
  subject text check (subject is null or char_length(btrim(subject)) <= 80),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint student_interventions_student_teacher_fkey
    foreign key (student_id, teacher_id)
    references public.students (id, teacher_id) on delete cascade
);

create index if not exists student_interventions_student_idx
  on public.student_interventions (student_id, occurred_on desc);
create index if not exists student_interventions_teacher_idx
  on public.student_interventions (teacher_id, occurred_on desc);

comment on table public.student_interventions is
  'A log of what the teacher did. Student-owned via composite FK; never AI-generated.';

alter table public.student_interventions enable row level security;
revoke all on public.student_interventions from anon, authenticated;

drop policy if exists student_interventions_select_own on public.student_interventions;
create policy student_interventions_select_own on public.student_interventions
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_interventions_insert_own on public.student_interventions;
create policy student_interventions_insert_own on public.student_interventions
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_interventions_update_own on public.student_interventions;
create policy student_interventions_update_own on public.student_interventions
  for update to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id))
  with check (teacher_id = (select auth.uid()));

drop policy if exists student_interventions_delete_own on public.student_interventions;
create policy student_interventions_delete_own on public.student_interventions
  for delete to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

grant select, insert, update, delete on public.student_interventions to authenticated;

-- ---------------------------------------------------------------------------
-- basis_count on alerts — how many distinct signals produced this alert
--
-- Distinct from assessment_count, which is how many assessments were examined.
-- basis_count answers "why did this fire?", which is what the UI shows.
-- ---------------------------------------------------------------------------
alter table public.student_alerts
  add column if not exists basis_count integer
  check (basis_count is null or basis_count >= 0);

comment on column public.student_alerts.basis_count is
  'Number of distinct signals behind the alert (e.g. grade drop + missing work = 2).';

-- ---------------------------------------------------------------------------
-- service_role table grants
--
-- 0010 revoked ALL privileges on the student tables from anon and authenticated,
-- which was correct, but the tables were created without granting anything to
-- service_role. That silently broke the account-maintenance path (and any
-- admin API operation) with 42501. Found by the isolation test suite, not by
-- reading the SQL.
--
-- service_role is a trusted server-side role; it is never used to serve a
-- teacher's request. Granting it here restores maintenance capability while
-- leaving anon locked out and RLS governing authenticated.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.students to service_role;
grant select, insert, update, delete on public.student_grades to service_role;
grant select, insert, update, delete on public.student_submissions to service_role;
grant select, insert, update, delete on public.student_alerts to service_role;
grant select, insert, update, delete on public.student_interventions to service_role;
grant select, insert, update on public.teacher_alert_settings to service_role;

grant execute on function public.soft_delete_student(uuid) to service_role;
grant execute on function public.restore_student(uuid) to service_role;
grant execute on function public.students_is_active(uuid, uuid) to service_role;
grant execute on function public.purge_deleted_students() to service_role;
grant execute on function public.purge_expired_students_job() to service_role;
grant execute on function public.admin_read_student(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- teacher_id defaults to the caller
--
-- Without a default, every client insert must send teacher_id explicitly, and
-- omitting it fails the INSERT policy with a NULL comparison. Found by the
-- isolation suite's positive control: a teacher could not create their own
-- student. The API route had the same defect and would have failed in production.
--
-- This does NOT weaken isolation: the policy still requires
-- teacher_id = auth.uid(), so sending another teacher's id is still rejected.
-- ---------------------------------------------------------------------------
alter table public.students alter column teacher_id set default auth.uid();
alter table public.student_grades alter column teacher_id set default auth.uid();
alter table public.student_submissions alter column teacher_id set default auth.uid();
alter table public.student_alerts alter column teacher_id set default auth.uid();
alter table public.student_interventions alter column teacher_id set default auth.uid();
alter table public.teacher_alert_settings alter column teacher_id set default auth.uid();
