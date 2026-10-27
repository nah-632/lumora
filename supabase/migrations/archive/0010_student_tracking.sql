-- 0010_student_tracking.sql — LUMORA student progress tracking
--
-- Re-runnable: every object uses a drop-if-exists or if-not-exists guard, so
-- re-applying after a partial failure is safe.
--
-- Privacy: students are records owned by exactly one teacher. There are no
-- student accounts and no student-facing access path. Anon has no access.
--
-- Isolation: every child table carries teacher_id and links to its parent
-- through the COMPOSITE key (student_id, teacher_id) -> students(id, teacher_id).
-- A cross-teacher link is therefore a foreign-key violation, not merely a policy
-- breach that a future policy edit could reopen.
--
-- audit_logs columns verified against the live schema: it uses entity/entity_id,
-- not target_table/target_id. Roles use the existing app_role enum + has_role().

do $$ begin
  create type public.submission_status as enum ('submitted', 'late', 'missing');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.alert_type as enum ('grade_drop', 'missing_work', 'positive_trend', 'follow_up');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.alert_severity as enum ('info', 'attention', 'urgent');
exception when duplicate_object then null;
end $$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  grade_level text not null check (char_length(btrim(grade_level)) between 1 and 40),
  class_label text check (class_label is null or char_length(btrim(class_label)) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint students_id_teacher_key unique (id, teacher_id)
);

comment on table public.students is
  'One teacher owns each student record. Children are minors; no student-facing access exists.';

create index if not exists students_teacher_active_idx
  on public.students (teacher_id, created_at desc) where deleted_at is null;

create or replace function public.students_is_active(p_id uuid, p_teacher uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.id = p_id and s.teacher_id = p_teacher and s.deleted_at is null
  );
$$;

comment on function public.students_is_active(uuid, uuid) is
  'True only while the student exists, belongs to the teacher, and is not soft-deleted.';

create table if not exists public.student_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 80),
  assessment_name text not null check (char_length(btrim(assessment_name)) between 1 and 160),
  score numeric(7, 2) not null check (score >= 0),
  max_score numeric(7, 2) not null check (max_score > 0),
  date date not null,
  created_at timestamptz not null default now(),
  constraint student_grades_score_within_max check (score <= max_score),
  constraint student_grades_student_teacher_fkey
    foreign key (student_id, teacher_id)
    references public.students (id, teacher_id) on delete cascade
);

create index if not exists student_grades_student_date_idx
  on public.student_grades (student_id, date desc);
create index if not exists student_grades_teacher_subject_idx
  on public.student_grades (teacher_id, subject, date desc);

create table if not exists public.student_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  project_name text not null check (char_length(btrim(project_name)) between 1 and 160),
  status public.submission_status not null,
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  date date not null,
  created_at timestamptz not null default now(),
  constraint student_submissions_student_teacher_fkey
    foreign key (student_id, teacher_id)
    references public.students (id, teacher_id) on delete cascade
);

create index if not exists student_submissions_student_date_idx
  on public.student_submissions (student_id, date desc);

create table if not exists public.student_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  alert_type public.alert_type not null,
  severity public.alert_severity not null,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  suggested_action text check (suggested_action is null or char_length(suggested_action) <= 280),
  evidence text check (evidence is null or char_length(evidence) <= 500),
  assessment_count integer check (assessment_count is null or assessment_count >= 0),
  is_read boolean not null default false,
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  dismissed_reason text check (dismissed_reason is null or char_length(dismissed_reason) <= 500),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  prompt_version text not null default 'student-alerts@1.0.0',
  generation_run_id uuid,
  created_at timestamptz not null default now(),
  constraint student_alerts_student_teacher_fkey
    foreign key (student_id, teacher_id)
    references public.students (id, teacher_id) on delete cascade
);

comment on column public.student_alerts.dedupe_key is
  'Digest of the deterministic signal. With (student_id, alert_type) it makes regeneration idempotent.';

-- NOTE: an earlier draft used a generated column to null out student_id when the
-- parent was soft-deleted. Postgres rejects that: generated expressions must be
-- IMMUTABLE, while students_is_active() reads another table and is only STABLE.
-- Soft-delete hiding is enforced by the RLS policies below instead, which is
-- equivalent in effect and does not require an immutable expression.

create unique index if not exists student_alerts_dedupe_idx
  on public.student_alerts (student_id, alert_type, dedupe_key);
create index if not exists student_alerts_teacher_unread_idx
  on public.student_alerts (teacher_id, created_at desc) where is_read = false;
create index if not exists student_alerts_student_idx
  on public.student_alerts (student_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists students_touch_updated_at on public.students;
create trigger students_touch_updated_at
  before update on public.students
  for each row execute function public.touch_updated_at();

-- SECURITY DEFINER because a teacher deliberately has no UPDATE grant on
-- deleted_at; the function is the only path. Ownership checks below still use
-- auth.uid(), so it can only ever affect the caller's own rows.
create or replace function public.soft_delete_student(p_student_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_teacher uuid := (select auth.uid());
  v_rows integer;
begin
  if v_teacher is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.students
     set deleted_at = now()
   where id = p_student_id and teacher_id = v_teacher and deleted_at is null;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.restore_student(p_student_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_teacher uuid := (select auth.uid());
  v_deleted timestamptz;
begin
  if v_teacher is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select deleted_at into v_deleted
    from public.students
   where id = p_student_id and teacher_id = v_teacher;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_deleted is null then
    raise exception 'not_deleted' using errcode = 'P0001';
  end if;

  if v_deleted < now() - interval '30 days' then
    raise exception 'restore_window_expired' using errcode = 'P0001';
  end if;

  update public.students
     set deleted_at = null
   where id = p_student_id and teacher_id = v_teacher;
end;
$$;

create or replace function public.purge_deleted_students()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  with purged as (
    delete from public.students
     where deleted_at is not null and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_count from purged;
  return v_count;
end;
$$;

create or replace function public.purge_expired_students_job()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_purged integer;
begin
  v_purged := public.purge_deleted_students();
  if v_purged > 0 then
    -- audit_logs uses entity/entity_id (verified against live schema).
    insert into public.audit_logs (actor_id, actor_role, action, entity, after_val)
    values (null, 'admin', 'students.purge', 'students',
            jsonb_build_object('purged_count', v_purged));
  end if;
end;
$$;

comment on function public.purge_expired_students_job() is
  'Daily job: permanently removes students 30 days past soft-deletion. Children cascade.';

do $$ begin
  perform cron.schedule(
    'purge-expired-students',
    '15 3 * * *',
    $cron$ select public.purge_expired_students_job(); $cron$
  );
exception
  -- 'undefined_schema' is not a valid PL/pgSQL condition name (verified by the
  -- server rejecting it). Valid: undefined_table, undefined_function,
  -- undefined_object, invalid_schema_name.
  when undefined_function or undefined_object or invalid_schema_name or undefined_table then
    raise notice 'pg_cron unavailable — schedule purge_deleted_students() by other means';
  when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

-- ===========================================================================
-- RLS: default deny. Anon is never granted access.
-- ===========================================================================
alter table public.students enable row level security;
alter table public.student_grades enable row level security;
alter table public.student_submissions enable row level security;
alter table public.student_alerts enable row level security;

revoke all on public.students from anon, authenticated;
revoke all on public.student_grades from anon, authenticated;
revoke all on public.student_submissions from anon, authenticated;
revoke all on public.student_alerts from anon, authenticated;

-- students: owner only, only while not soft-deleted. No DELETE policy exists —
-- teachers cannot hard-delete; the SECURITY DEFINER job purges past 30 days.
drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students
  for select to authenticated
  using (teacher_id = (select auth.uid()) and deleted_at is null);

drop policy if exists students_insert_own on public.students;
create policy students_insert_own on public.students
  for insert to authenticated
  with check (teacher_id = (select auth.uid()));

drop policy if exists students_update_own on public.students;
create policy students_update_own on public.students
  for update to authenticated
  using (teacher_id = (select auth.uid()) and deleted_at is null)
  with check (teacher_id = (select auth.uid()));

grant select, insert on public.students to authenticated;
-- Column-level: a teacher may edit these and no others. deleted_at is reachable
-- only through soft_delete_student()/restore_student().
grant update (name, grade_level, class_label) on public.students to authenticated;

drop policy if exists student_grades_select_own on public.student_grades;
create policy student_grades_select_own on public.student_grades
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_grades_insert_own on public.student_grades;
create policy student_grades_insert_own on public.student_grades
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_grades_update_own on public.student_grades;
create policy student_grades_update_own on public.student_grades
  for update to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id))
  with check (teacher_id = (select auth.uid()));

drop policy if exists student_grades_delete_own on public.student_grades;
create policy student_grades_delete_own on public.student_grades
  for delete to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

grant select, insert, update, delete on public.student_grades to authenticated;

drop policy if exists student_submissions_select_own on public.student_submissions;
create policy student_submissions_select_own on public.student_submissions
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_submissions_insert_own on public.student_submissions;
create policy student_submissions_insert_own on public.student_submissions
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_submissions_update_own on public.student_submissions;
create policy student_submissions_update_own on public.student_submissions
  for update to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id))
  with check (teacher_id = (select auth.uid()));

drop policy if exists student_submissions_delete_own on public.student_submissions;
create policy student_submissions_delete_own on public.student_submissions
  for delete to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

grant select, insert, update, delete on public.student_submissions to authenticated;

-- student_alerts: teachers READ and may only toggle is_read / snooze / dismiss.
-- Alert text is AI output; editing or deleting it would destroy the evidence
-- trail, so no UPDATE policy exists for message/severity and no DELETE grant.
drop policy if exists student_alerts_select_own on public.student_alerts;
create policy student_alerts_select_own on public.student_alerts
  for select to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_alerts_insert_own on public.student_alerts;
create policy student_alerts_insert_own on public.student_alerts
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id));

drop policy if exists student_alerts_update_own on public.student_alerts;
create policy student_alerts_update_own on public.student_alerts
  for update to authenticated
  using (teacher_id = (select auth.uid()) and public.students_is_active(student_id, teacher_id))
  with check (teacher_id = (select auth.uid()));

grant select, insert on public.student_alerts to authenticated;
grant update (is_read, snoozed_until, dismissed_at, dismissed_reason)
  on public.student_alerts to authenticated;

-- ===========================================================================
-- Admin access: deliberately narrow, reason-bearing and audited.
-- There is NO admin RLS policy on any student table. Standing admin access
-- does not exist. Support reads one student at a time through this function,
-- which requires the admin role, a written reason, and writes an audit row.
-- ===========================================================================
create or replace function public.admin_read_student(
  p_student_id uuid,
  p_reason text
)
returns table (
  student_id uuid,
  name text,
  grade_level text,
  class_label text,
  grades jsonb,
  submissions jsonb,
  alerts jsonb
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  -- Reuses the existing has_role helper and the real app_role enum.
  if not public.has_role(v_caller, 'admin'::public.app_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, after_val)
  values (v_caller, 'admin', 'student.read', 'students', p_student_id::text,
          jsonb_build_object('reason', btrim(p_reason), 'channel', 'admin_read_student'));

  return query
  select
    s.id, s.name, s.grade_level, s.class_label,
    coalesce((select jsonb_agg(to_jsonb(g) order by g.date desc)
              from public.student_grades g where g.student_id = s.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(sub) order by sub.date desc)
              from public.student_submissions sub where sub.student_id = s.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
              from public.student_alerts a
              where a.student_id = s.id and a.dismissed_at is null), '[]'::jsonb)
  from public.students s
  where s.id = p_student_id and s.deleted_at is null;
end;
$$;

comment on function public.admin_read_student(uuid, text) is
  'The ONLY admin read path to student data. Requires admin role + written reason; writes an audit row.';

revoke all on function public.admin_read_student(uuid, text) from public, anon;
grant execute on function public.admin_read_student(uuid, text) to authenticated;

-- students_is_active() is called by every child-table RLS policy, so
-- authenticated MUST be able to execute it. Revoking it here (as an earlier
-- draft did) makes every policy fail with 42501 — found by running the
-- isolation test, not by reading the SQL.
revoke all on function public.students_is_active(uuid, uuid) from public, anon;
grant execute on function public.students_is_active(uuid, uuid) to authenticated;
revoke all on function public.purge_deleted_students() from public, anon, authenticated;
revoke all on function public.purge_expired_students_job() from public, anon, authenticated;
grant execute on function public.soft_delete_student(uuid) to authenticated;
grant execute on function public.restore_student(uuid) to authenticated;
revoke all on function public.soft_delete_student(uuid) from anon, public;
revoke all on function public.restore_student(uuid) from anon, public;
