-- 0000_baseline.sql — the schema as it stood before the numbered migrations were
-- replayed, reconstructed from the database catalogs.
--
-- WHY THIS FILE EXISTS
--
-- Migrations 0001-0009 were lost from the repository. 0010 introduced the student
-- tables and depends on objects none of the surviving files create: the
-- `app_role` enum, `has_role()`, `audit_logs`, `profiles`, `user_roles`,
-- `teacher_preferences`, `usage_quotas`, the conversation and project tables, and
-- the curriculum tables. A clean `supabase db reset` therefore cannot rebuild the
-- database from the repository alone, and the gap silently grows every time
-- someone assumes it can.
--
-- This file closes that gap. It was produced by reading the catalogs of the test
-- project (pg_type, pg_class, pg_attribute, pg_attrdef, pg_proc, pg_constraint,
-- pg_indexes, pg_trigger, pg_policies, information_schema privileges) and emitting
-- equivalent DDL. It is not a pg_dump: no database password was available, and
-- pg_dump's own catalog reads are what this replicates.
--
-- WHAT IT CONTAINS
--
-- Structure only: extensions, enum types, sequences, tables, functions (with
-- bodies, including set_owner_teacher() as of 0015), constraints, indexes,
-- triggers including on_auth_user_created on auth.users, RLS enablement, all
-- policies, and grants. Plus explicit `revoke all ... from anon` on the six
-- teacher-private tables — catalogs record grants but not revokes, so Supabase's
-- permissive default for anon survives a naive copy unless it is stated.
--
-- No rows. No COPY blocks. No auth.users data. No secrets. Verified: zero
-- top-level DML statements, in a file where the only INSERT/DELETE/UPDATE
-- keywords appear inside function bodies.
--
-- HOW TO RUN IT
--
--   DO NOT run this against an existing database. Every statement is idempotent
--   (IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS), but a baseline that
--   is replayed over a live schema is how a baseline becomes a second source of
--   truth. It is for one thing only: building an empty database that migrations
--   0010 onward can then be applied to.
--
-- FUNCTION GRANTS, AND WHY 0016 EXISTS
--
-- The export first reproduced a drift rather than fixing it: anon and PUBLIC held
-- EXECUTE on five SECURITY DEFINER functions that 0010 had already ordered
-- revoked. That is recorded in 0016_function_grants_align.sql, which applies the
-- missing revokes; this file now reflects the corrected state, so a rebuild matches
-- the database the tests actually run against.
--
-- NUMBERING
--
-- `0000` sorts before every other migration, so a fresh `supabase db reset` runs
-- it first and the numbered files then behave exactly as they were written and
-- tested. The alternative — renumbering 0010-0015 — would rewrite migrations that
-- have already run in real environments, and make the repository disagree with
-- the databases about what ran.
--
-- DEFAULT PRIVILEGES
--
-- The test project's pg_default_acl for `public` hands every new table, sequence
-- and function in that schema to anon, authenticated and service_role. Local
-- Supabase does the same. That is why this file revokes before it grants: creating
-- the objects under those defaults is unavoidable, so the only way to land on the
-- real privilege set is to strip them per object afterwards. Altering the default
-- ACLs instead would tie the file to which role owns them (postgres here,
-- supabase_admin there) and would still not fix objects created before the change.
--
-- Known limitation: it reflects the test project at the time of export. Objects
-- that existed only in another environment are not represented.
begin;
create extension if not exists "citext";
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create type public.alert_basis_kind as enum ('assessments', 'submissions');
create type public.alert_severity as enum ('info', 'attention', 'urgent');
create type public.alert_type as enum ('grade_drop', 'missing_work', 'positive_trend', 'follow_up');
create type public.app_role as enum ('teacher', 'reviewer', 'admin');
create type public.generation_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.source_status as enum ('draft', 'in_review', 'approved', 'archived');
create type public.stage_level as enum ('primary', 'intermediate', 'secondary');
create type public.submission_status as enum ('submitted', 'late', 'missing');
create type public.curriculum_source_kind as enum ('official', 'supplementary_unverified');

create sequence if not exists public.audit_logs_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1;
create table if not exists public.audit_logs (
  id bigint default nextval('audit_logs_id_seq'::regclass) not null,
  actor_id uuid,
  actor_role app_role,
  action text not null,
  entity text not null,
  entity_id text,
  before_val jsonb,
  after_val jsonb,
  ip_address inet,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.conversations (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text default 'New conversation'::text not null,
  subject text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.curriculum_chunks (
  id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.curriculum_documents (
  id uuid default gen_random_uuid() not null,
  source_id uuid not null,
  title text not null,
  unit text,
  page_from integer,
  page_to integer,
  created_at timestamp with time zone default now() not null
);

alter table public.curriculum_documents
  add column if not exists lesson_topic text;
alter table public.curriculum_documents
  add column if not exists learning_outcomes_text text;
alter table public.curriculum_documents
  add column if not exists term smallint;
alter table public.curriculum_documents
  add column if not exists grade_level smallint;
alter table public.curriculum_documents
  add column if not exists unit_number integer;
create table if not exists public.curriculum_sources (
  id uuid default gen_random_uuid() not null,
  title text not null,
  publisher text,
  stage stage_level,
  subject text,
  edition text,
  status source_status default 'draft'::source_status not null,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.curriculum_sources
  add column if not exists source_kind public.curriculum_source_kind not null
    default 'supplementary_unverified'::public.curriculum_source_kind;
alter table public.curriculum_sources
  add column if not exists base_url text;
alter table public.curriculum_sources
  add column if not exists verification_note text;

-- pedagogical_activities was added by 0017 and dropped by 0019: it held no rows
-- and nothing read it. Removed from the baseline so a rebuild does not recreate
-- a table the project does not have.
create table if not exists public.generation_runs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  task_type text not null,
  provider text not null,
  model text not null,
  prompt_version text,
  status generation_status default 'queued'::generation_status not null,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_estimate numeric(12,6),
  cost_actual numeric(12,6),
  error_code text,
  created_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone
);
create table if not exists public.messages (
  id uuid default gen_random_uuid() not null,
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null,
  content text not null,
  generation_run_id uuid,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.profiles (
  id uuid not null,
  email citext not null,
  full_name text,
  avatar_url text,
  school_name text,
  stage stage_level,
  grade text,
  subject text,
  locale text default 'ar'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.project_item_versions (
  id uuid default gen_random_uuid() not null,
  project_item_id uuid not null,
  user_id uuid not null,
  version_no integer not null,
  content jsonb not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.project_items (
  id uuid default gen_random_uuid() not null,
  project_id uuid not null,
  user_id uuid not null,
  position integer default 0 not null,
  item_type text not null,
  content jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.projects (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind text not null,
  title text not null,
  subject text,
  stage stage_level,
  grade text,
  term text,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.student_alerts (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  teacher_id uuid not null,
  alert_type alert_type not null,
  severity alert_severity not null,
  message text not null,
  suggested_action text,
  evidence text,
  assessment_count integer,
  is_read boolean default false not null,
  snoozed_until timestamp with time zone,
  dismissed_at timestamp with time zone,
  dismissed_reason text,
  dedupe_key text not null,
  prompt_version text default 'student-alerts@1.0.0'::text not null,
  generation_run_id uuid,
  created_at timestamp with time zone default now() not null,
  basis_count integer,
  basis_kind alert_basis_kind,
  evidence_ids uuid[]
);
create table if not exists public.student_grades (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  teacher_id uuid not null,
  subject text not null,
  assessment_name text not null,
  score numeric(7,2) not null,
  max_score numeric(7,2) not null,
  date date not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.student_interventions (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  teacher_id uuid not null,
  action text not null,
  alert_id uuid,
  subject text,
  occurred_on date default CURRENT_DATE not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.student_submissions (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  teacher_id uuid not null,
  project_name text not null,
  status submission_status not null,
  feedback text,
  date date not null,
  created_at timestamp with time zone default now() not null,
  subject text
);
create table if not exists public.students (
  id uuid default gen_random_uuid() not null,
  teacher_id uuid not null,
  name text not null,
  grade_level text not null,
  class_label text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);
create table if not exists public.teacher_alert_settings (
  teacher_id uuid not null,
  drop_threshold_pct integer default 20 not null,
  missing_work_alerts boolean default true not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.teacher_preferences (
  user_id uuid not null,
  ui_locale text default 'ar'::text not null,
  content_locale text default 'ar'::text not null,
  digit_style text default 'western'::text not null,
  explanation_style text default 'balanced'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.usage_quotas (
  user_id uuid not null,
  period_start date default (date_trunc('month'::text, now()))::date not null,
  runs_limit integer default 200 not null,
  runs_used integer default 0 not null,
  tokens_limit bigint default 2000000 not null,
  tokens_used bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  role app_role not null,
  granted_by uuid,
  granted_at timestamp with time zone default now() not null
);
CREATE OR REPLACE FUNCTION public.admin_read_student(p_student_id uuid, p_reason text)
 RETURNS TABLE(student_id uuid, name text, grade_level text, class_label text, grades jsonb, submissions jsonb, alerts jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.alert_basis_is_consistent(p_alert uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    (select a.basis_count is null
         or a.basis_count = coalesce(array_length(a.evidence_ids, 1), 0)
     from public.student_alerts a
     where a.id = p_alert),
    false
  );
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when coalesce(new.raw_user_meta_data ->> 'locale', 'ar') = 'en' then 'en' else 'ar' end
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'teacher')
  on conflict (user_id, role) do nothing;

  insert into public.teacher_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.usage_quotas (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.has_privilege_probe(p_role text, p_table text, p_privilege text, p_column text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Names are validated against the catalogue rather than interpolated blindly:
  -- a definer function must never become a way to run arbitrary SQL.
  if not exists (select 1 from pg_roles where rolname = p_role) then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = p_table
  ) then
    raise exception 'unknown table' using errcode = '22023';
  end if;

  if p_column is null then
    return has_table_privilege(p_role, format('public.%I', p_table), p_privilege);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  ) then
    raise exception 'unknown column' using errcode = '22023';
  end if;

  return has_column_privilege(p_role, format('public.%I', p_table), p_column, p_privilege);
end;
$function$;
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.has_role(p_user_id, 'admin'::app_role);
$function$;
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.has_role(p_user_id, 'admin'::app_role)
      or public.has_role(p_user_id, 'reviewer'::app_role);
$function$;
CREATE OR REPLACE FUNCTION public.purge_deleted_students()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.purge_expired_students_job()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.restore_student(p_student_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.set_owner_teacher()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    return new;
  end if;
  if new.teacher_id is null then
    new.teacher_id := caller;
    return new;
  end if;
  if new.teacher_id <> caller then
    raise exception
      'refusing to create a row owned by another teacher'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.soft_delete_student(p_student_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.students_is_active(p_id uuid, p_teacher uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.students s
    where s.id = p_id and s.teacher_id = p_teacher and s.deleted_at is null
  );
$function$;
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.search_curriculum_text(
  p_subject text,
  p_grade_level smallint,
  p_lesson_topic text default null,
  p_term smallint default null,
  p_limit integer default 3
)
returns table (
  document_id uuid,
  source_id uuid,
  source_title text,
  source_url text,
  lesson_topic text,
  unit_number integer,
  text_content text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with matched as (
    -- Rule 1: the specific lesson. Only reachable when the caller named one.
    select
      d.id as document_id,
      d.source_id,
      s.title as source_title,
      s.base_url as source_url,
      d.lesson_topic,
      d.unit_number,
      coalesce(
        nullif(btrim(d.learning_outcomes_text), ''),
        (select string_agg(c.content, E'\n\n' order by c.chunk_index)
           from public.curriculum_chunks c
          where c.document_id = d.id)
      ) as text_content
      from public.curriculum_documents d
      join public.curriculum_sources s on s.id = d.source_id
     where s.verified_at is not null
       and s.source_kind = 'official'
       and s.subject = p_subject
       and d.grade_level = p_grade_level
       and d.lesson_topic is not null
       and p_lesson_topic is not null
       and d.lesson_topic = p_lesson_topic
       and (d.term is null or p_term is null or d.term = p_term)

    union all

    -- Rule 2: scoped to the unit or the subject, not to one lesson. These are
    -- the only rows eligible when the caller named no topic, or named one that
    -- no verified document covers.
    select
      d.id,
      d.source_id,
      s.title,
      s.base_url,
      d.lesson_topic,
      d.unit_number,
      coalesce(
        nullif(btrim(d.learning_outcomes_text), ''),
        (select string_agg(c.content, E'\n\n' order by c.chunk_index)
           from public.curriculum_chunks c
          where c.document_id = d.id)
      )
      from public.curriculum_documents d
      join public.curriculum_sources s on s.id = d.source_id
     where s.verified_at is not null
       and s.source_kind = 'official'
       and s.subject = p_subject
       and d.grade_level = p_grade_level
       and d.lesson_topic is null
       and (d.term is null or p_term is null or d.term = p_term)
  )
  select m.document_id, m.source_id, m.source_title, m.source_url,
         m.lesson_topic, m.unit_number, m.text_content
    from matched m
   where m.text_content is not null
   order by (m.lesson_topic is null), m.unit_number nulls last
   limit least(coalesce(p_limit, 3), 10);
$function$;
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table public.curriculum_chunks add constraint curriculum_chunks_document_id_chunk_index_key UNIQUE (document_id, chunk_index);
alter table public.curriculum_chunks add constraint curriculum_chunks_pkey PRIMARY KEY (id);
alter table public.curriculum_documents add constraint curriculum_documents_pkey PRIMARY KEY (id);
alter table public.curriculum_sources add constraint curriculum_sources_pkey PRIMARY KEY (id);

alter table public.generation_runs add constraint generation_runs_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.project_item_versions add constraint project_item_versions_pkey PRIMARY KEY (id);
alter table public.project_item_versions add constraint project_item_versions_project_item_id_version_no_key UNIQUE (project_item_id, version_no);
alter table public.project_items add constraint project_items_pkey PRIMARY KEY (id);
alter table public.projects add constraint projects_pkey PRIMARY KEY (id);
alter table public.student_alerts add constraint student_alerts_pkey PRIMARY KEY (id);
alter table public.student_grades add constraint student_grades_pkey PRIMARY KEY (id);
alter table public.student_interventions add constraint student_interventions_pkey PRIMARY KEY (id);
alter table public.student_submissions add constraint student_submissions_pkey PRIMARY KEY (id);
alter table public.students add constraint students_id_teacher_key UNIQUE (id, teacher_id);
alter table public.students add constraint students_pkey PRIMARY KEY (id);
alter table public.teacher_alert_settings add constraint teacher_alert_settings_pkey PRIMARY KEY (teacher_id);
alter table public.teacher_preferences add constraint teacher_preferences_pkey PRIMARY KEY (user_id);
alter table public.usage_quotas add constraint usage_quotas_pkey PRIMARY KEY (user_id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (id);
alter table public.user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role);
alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.curriculum_chunks add constraint curriculum_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES curriculum_documents(id) ON DELETE CASCADE;
alter table public.curriculum_documents add constraint curriculum_documents_source_id_fkey FOREIGN KEY (source_id) REFERENCES curriculum_sources(id) ON DELETE CASCADE;
alter table public.curriculum_sources add constraint curriculum_sources_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.curriculum_documents add constraint curriculum_documents_term_check check (term is null or term between 1 and 3);
alter table public.curriculum_documents add constraint curriculum_documents_grade_level_check check (grade_level is null or grade_level between 1 and 12);

alter table public.generation_runs add constraint generation_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])));
alter table public.messages add constraint messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_locale_check CHECK ((locale = ANY (ARRAY['ar'::text, 'en'::text])));
alter table public.project_item_versions add constraint project_item_versions_project_item_id_fkey FOREIGN KEY (project_item_id) REFERENCES project_items(id) ON DELETE CASCADE;
alter table public.project_item_versions add constraint project_item_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.project_items add constraint project_items_item_type_check CHECK ((item_type = ANY (ARRAY['section'::text, 'question'::text, 'objective'::text, 'note'::text])));
alter table public.project_items add constraint project_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.project_items add constraint project_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.projects add constraint projects_kind_check CHECK ((kind = ANY (ARRAY['lesson_plan'::text, 'exam'::text, 'question_bank'::text])));
alter table public.projects add constraint projects_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'ready'::text, 'archived'::text])));
alter table public.projects add constraint projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.student_alerts add constraint student_alerts_assessment_count_check CHECK (((assessment_count IS NULL) OR (assessment_count >= 0)));
alter table public.student_alerts add constraint student_alerts_basis_count_check CHECK (((basis_count IS NULL) OR (basis_count >= 0)));
alter table public.student_alerts add constraint student_alerts_basis_pair CHECK (((basis_count IS NULL) = (basis_kind IS NULL)));
alter table public.student_alerts add constraint student_alerts_dedupe_key_check CHECK (((char_length(dedupe_key) >= 1) AND (char_length(dedupe_key) <= 200)));
alter table public.student_alerts add constraint student_alerts_dismissed_reason_check CHECK (((dismissed_reason IS NULL) OR (char_length(dismissed_reason) <= 500)));
alter table public.student_alerts add constraint student_alerts_evidence_check CHECK (((evidence IS NULL) OR (char_length(evidence) <= 500)));
alter table public.student_alerts add constraint student_alerts_message_check CHECK (((char_length(btrim(message)) >= 1) AND (char_length(btrim(message)) <= 280)));
alter table public.student_alerts add constraint student_alerts_student_teacher_fkey FOREIGN KEY (student_id, teacher_id) REFERENCES students(id, teacher_id) ON DELETE CASCADE;
alter table public.student_alerts add constraint student_alerts_suggested_action_check CHECK (((suggested_action IS NULL) OR (char_length(suggested_action) <= 280)));
alter table public.student_alerts add constraint student_alerts_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.student_grades add constraint student_grades_assessment_name_check CHECK (((char_length(btrim(assessment_name)) >= 1) AND (char_length(btrim(assessment_name)) <= 160)));
alter table public.student_grades add constraint student_grades_max_score_check CHECK ((max_score > (0)::numeric));
alter table public.student_grades add constraint student_grades_score_check CHECK ((score >= (0)::numeric));
alter table public.student_grades add constraint student_grades_score_within_max CHECK ((score <= max_score));
alter table public.student_grades add constraint student_grades_student_teacher_fkey FOREIGN KEY (student_id, teacher_id) REFERENCES students(id, teacher_id) ON DELETE CASCADE;
alter table public.student_grades add constraint student_grades_subject_check CHECK (((char_length(btrim(subject)) >= 1) AND (char_length(btrim(subject)) <= 80)));
alter table public.student_grades add constraint student_grades_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.student_interventions add constraint student_interventions_action_check CHECK (((char_length(btrim(action)) >= 3) AND (char_length(btrim(action)) <= 1000)));
alter table public.student_interventions add constraint student_interventions_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES student_alerts(id) ON DELETE SET NULL;
alter table public.student_interventions add constraint student_interventions_student_teacher_fkey FOREIGN KEY (student_id, teacher_id) REFERENCES students(id, teacher_id) ON DELETE CASCADE;
alter table public.student_interventions add constraint student_interventions_subject_check CHECK (((subject IS NULL) OR (char_length(btrim(subject)) <= 80)));
alter table public.student_interventions add constraint student_interventions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.student_submissions add constraint student_submissions_feedback_check CHECK (((feedback IS NULL) OR (char_length(feedback) <= 2000)));
alter table public.student_submissions add constraint student_submissions_project_name_check CHECK (((char_length(btrim(project_name)) >= 1) AND (char_length(btrim(project_name)) <= 160)));
alter table public.student_submissions add constraint student_submissions_student_teacher_fkey FOREIGN KEY (student_id, teacher_id) REFERENCES students(id, teacher_id) ON DELETE CASCADE;
alter table public.student_submissions add constraint student_submissions_subject_check CHECK (((subject IS NULL) OR ((char_length(btrim(subject)) >= 1) AND (char_length(btrim(subject)) <= 80))));
alter table public.student_submissions add constraint student_submissions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.students add constraint students_class_label_check CHECK (((class_label IS NULL) OR (char_length(btrim(class_label)) <= 40)));
alter table public.students add constraint students_grade_level_check CHECK (((char_length(btrim(grade_level)) >= 1) AND (char_length(btrim(grade_level)) <= 40)));
alter table public.students add constraint students_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120)));
alter table public.students add constraint students_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.teacher_alert_settings add constraint teacher_alert_settings_drop_threshold_pct_check CHECK (((drop_threshold_pct >= 1) AND (drop_threshold_pct <= 100)));
alter table public.teacher_alert_settings add constraint teacher_alert_settings_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.teacher_preferences add constraint teacher_preferences_content_locale_check CHECK ((content_locale = ANY (ARRAY['ar'::text, 'en'::text])));
alter table public.teacher_preferences add constraint teacher_preferences_digit_style_check CHECK ((digit_style = ANY (ARRAY['western'::text, 'arabic'::text])));
alter table public.teacher_preferences add constraint teacher_preferences_explanation_style_check CHECK ((explanation_style = ANY (ARRAY['concise'::text, 'balanced'::text, 'detailed'::text])));
alter table public.teacher_preferences add constraint teacher_preferences_ui_locale_check CHECK ((ui_locale = ANY (ARRAY['ar'::text, 'en'::text])));
alter table public.teacher_preferences add constraint teacher_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.usage_quotas add constraint usage_quotas_check CHECK (((runs_used >= 0) AND (tokens_used >= 0)));
alter table public.usage_quotas add constraint usage_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.user_roles add constraint user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs USING btree (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON public.conversations USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_curriculum_documents_source ON public.curriculum_documents USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_documents_lookup ON public.curriculum_documents USING btree (grade_level, term, lesson_topic);

CREATE INDEX IF NOT EXISTS idx_generation_runs_status ON public.generation_runs USING btree (status) WHERE (status = ANY (ARRAY['queued'::generation_status, 'running'::generation_status]));
CREATE INDEX IF NOT EXISTS idx_generation_runs_user_created ON public.generation_runs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_items_project ON public.project_items USING btree (project_id, "position");
CREATE INDEX IF NOT EXISTS idx_projects_user_kind ON public.projects USING btree (user_id, kind, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS student_alerts_dedupe_idx ON public.student_alerts USING btree (student_id, alert_type, dedupe_key);
CREATE INDEX IF NOT EXISTS student_alerts_student_idx ON public.student_alerts USING btree (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_alerts_teacher_unread_idx ON public.student_alerts USING btree (teacher_id, created_at DESC) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS student_grades_student_date_idx ON public.student_grades USING btree (student_id, date DESC);
CREATE INDEX IF NOT EXISTS student_grades_teacher_subject_idx ON public.student_grades USING btree (teacher_id, subject, date DESC);
CREATE INDEX IF NOT EXISTS student_interventions_student_idx ON public.student_interventions USING btree (student_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS student_interventions_teacher_idx ON public.student_interventions USING btree (teacher_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS student_submissions_student_date_idx ON public.student_submissions USING btree (student_id, date DESC);
CREATE INDEX IF NOT EXISTS student_submissions_subject_idx ON public.student_submissions USING btree (student_id, subject, status);
CREATE INDEX IF NOT EXISTS students_teacher_active_idx ON public.students USING btree (teacher_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles USING btree (user_id);
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER trg_curriculum_sources_updated_at BEFORE UPDATE ON public.curriculum_sources FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER trg_project_items_updated_at BEFORE UPDATE ON public.project_items FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
CREATE TRIGGER student_alerts_set_owner BEFORE INSERT ON public.student_alerts FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER student_grades_set_owner BEFORE INSERT ON public.student_grades FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER student_interventions_set_owner BEFORE INSERT ON public.student_interventions FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER student_submissions_set_owner BEFORE INSERT ON public.student_submissions FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER students_set_owner BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER students_touch_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER teacher_alert_settings_set_owner BEFORE INSERT ON public.teacher_alert_settings FOR EACH ROW EXECUTE FUNCTION set_owner_teacher();
CREATE TRIGGER teacher_alert_settings_touch BEFORE UPDATE ON public.teacher_alert_settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_teacher_preferences_updated_at BEFORE UPDATE ON public.teacher_preferences FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.curriculum_chunks enable row level security;
alter table public.curriculum_chunks force row level security;
alter table public.curriculum_documents enable row level security;
alter table public.curriculum_documents force row level security;
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_sources force row level security;

alter table public.generation_runs enable row level security;
alter table public.generation_runs force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.project_item_versions enable row level security;
alter table public.project_item_versions force row level security;
alter table public.project_items enable row level security;
alter table public.project_items force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.student_alerts enable row level security;
alter table public.student_grades enable row level security;
alter table public.student_interventions enable row level security;
alter table public.student_submissions enable row level security;
alter table public.students enable row level security;
alter table public.teacher_alert_settings enable row level security;
alter table public.teacher_preferences enable row level security;
alter table public.teacher_preferences force row level security;
alter table public.usage_quotas enable row level security;
alter table public.usage_quotas force row level security;
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
create policy audit_insert_own on public.audit_logs as PERMISSIVE for insert to authenticated with check ((actor_id = auth.uid()));
create policy audit_select_own_or_admin on public.audit_logs as PERMISSIVE for select to authenticated using (((actor_id = auth.uid()) OR is_admin(auth.uid())));
create policy conversations_delete_own on public.conversations as PERMISSIVE for delete to authenticated using ((user_id = auth.uid()));
create policy conversations_insert_own on public.conversations as PERMISSIVE for insert to authenticated with check ((user_id = auth.uid()));
create policy conversations_select_own on public.conversations as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy conversations_update_own on public.conversations as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy curriculum_sources_select_verified on public.curriculum_sources as PERMISSIVE for select to authenticated using (verified_at is not null);
create policy curriculum_documents_select_verified on public.curriculum_documents as PERMISSIVE for select to authenticated using (exists (select 1 from public.curriculum_sources s where s.id = curriculum_documents.source_id and s.verified_at is not null));
create policy curriculum_chunks_select_verified on public.curriculum_chunks as PERMISSIVE for select to authenticated using (exists (select 1 from public.curriculum_documents d join public.curriculum_sources s on s.id = d.source_id where d.id = curriculum_chunks.document_id and s.verified_at is not null));
create policy curriculum_chunks_write_staff on public.curriculum_chunks as PERMISSIVE for insert to authenticated with check (is_staff(auth.uid()));
create policy curriculum_docs_update_staff on public.curriculum_documents as PERMISSIVE for update to authenticated using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
create policy curriculum_docs_write_staff on public.curriculum_documents as PERMISSIVE for insert to authenticated with check (is_staff(auth.uid()));
create policy curriculum_sources_update_staff on public.curriculum_sources as PERMISSIVE for update to authenticated using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
create policy curriculum_sources_write_staff on public.curriculum_sources as PERMISSIVE for insert to authenticated with check (is_staff(auth.uid()));
create policy gen_runs_insert_own on public.generation_runs as PERMISSIVE for insert to authenticated with check ((user_id = auth.uid()));
create policy gen_runs_select_own on public.generation_runs as PERMISSIVE for select to authenticated using (((user_id = auth.uid()) OR is_admin(auth.uid())));
create policy gen_runs_update_own on public.generation_runs as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy messages_delete_own on public.messages as PERMISSIVE for delete to authenticated using ((user_id = auth.uid()));
create policy messages_insert_own on public.messages as PERMISSIVE for insert to authenticated with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid()))))));
create policy messages_select_own on public.messages as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy messages_update_own on public.messages as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy profiles_insert_self on public.profiles as PERMISSIVE for insert to authenticated with check ((id = auth.uid()));
create policy profiles_select_admin on public.profiles as PERMISSIVE for select to authenticated using (is_admin(auth.uid()));
create policy profiles_select_self on public.profiles as PERMISSIVE for select to authenticated using ((id = auth.uid()));
create policy profiles_update_self on public.profiles as PERMISSIVE for update to authenticated using ((id = auth.uid())) with check ((id = auth.uid()));
create policy piv_delete_own on public.project_item_versions as PERMISSIVE for delete to authenticated using ((user_id = auth.uid()));
create policy piv_insert_own on public.project_item_versions as PERMISSIVE for insert to authenticated with check ((user_id = auth.uid()));
create policy piv_select_own on public.project_item_versions as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy project_items_delete_own on public.project_items as PERMISSIVE for delete to authenticated using ((user_id = auth.uid()));
create policy project_items_insert_own on public.project_items as PERMISSIVE for insert to authenticated with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_items.project_id) AND (p.user_id = auth.uid()))))));
create policy project_items_select_own on public.project_items as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy project_items_update_own on public.project_items as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy projects_delete_own on public.projects as PERMISSIVE for delete to authenticated using ((user_id = auth.uid()));
create policy projects_insert_own on public.projects as PERMISSIVE for insert to authenticated with check ((user_id = auth.uid()));
create policy projects_select_own on public.projects as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy projects_update_own on public.projects as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy student_alerts_insert_own on public.student_alerts as PERMISSIVE for insert to authenticated with check (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_alerts_select_own on public.student_alerts as PERMISSIVE for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_alerts_update_own on public.student_alerts as PERMISSIVE for update to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy student_grades_delete_own on public.student_grades as PERMISSIVE for delete to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_grades_insert_own on public.student_grades as PERMISSIVE for insert to authenticated with check (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_grades_select_own on public.student_grades as PERMISSIVE for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_grades_update_own on public.student_grades as PERMISSIVE for update to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy student_interventions_delete_own on public.student_interventions as PERMISSIVE for delete to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_interventions_insert_own on public.student_interventions as PERMISSIVE for insert to authenticated with check (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_interventions_select_own on public.student_interventions as PERMISSIVE for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_interventions_update_own on public.student_interventions as PERMISSIVE for update to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy student_submissions_delete_own on public.student_submissions as PERMISSIVE for delete to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_submissions_insert_own on public.student_submissions as PERMISSIVE for insert to authenticated with check (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_submissions_select_own on public.student_submissions as PERMISSIVE for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id)));
create policy student_submissions_update_own on public.student_submissions as PERMISSIVE for update to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND students_is_active(student_id, teacher_id))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy students_insert_own on public.students as PERMISSIVE for insert to authenticated with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy students_select_own on public.students as PERMISSIVE for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL)));
create policy students_update_own on public.students as PERMISSIVE for update to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy teacher_alert_settings_insert_own on public.teacher_alert_settings as PERMISSIVE for insert to authenticated with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy teacher_alert_settings_select_own on public.teacher_alert_settings as PERMISSIVE for select to authenticated using ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy teacher_alert_settings_update_own on public.teacher_alert_settings as PERMISSIVE for update to authenticated using ((teacher_id = ( SELECT auth.uid() AS uid))) with check ((teacher_id = ( SELECT auth.uid() AS uid)));
create policy prefs_insert_self on public.teacher_preferences as PERMISSIVE for insert to authenticated with check ((user_id = auth.uid()));
create policy prefs_select_self on public.teacher_preferences as PERMISSIVE for select to authenticated using ((user_id = auth.uid()));
create policy prefs_update_self on public.teacher_preferences as PERMISSIVE for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy quotas_select_own on public.usage_quotas as PERMISSIVE for select to authenticated using (((user_id = auth.uid()) OR is_admin(auth.uid())));
create policy user_roles_select_own on public.user_roles as PERMISSIVE for select to authenticated using (((user_id = auth.uid()) OR is_staff(auth.uid())));

-- Privileges, stated from scratch
--
-- Every object is stripped of anon and authenticated first, then re-granted
-- from its own ACL. Grants alone are not enough: a fresh database hands new
-- tables in public to those roles by default privilege, so a baseline that
-- only adds grants leaves the defaults switched on and grants MORE than the
-- real database does. service_role is left exactly as it is.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Privileges, stated from scratch
--
-- Every object is stripped of anon and authenticated first, then re-granted
-- from its own ACL. Grants alone are not enough: a fresh database hands new
-- tables in public to those roles by default privilege, so a baseline that
-- only adds grants leaves the defaults switched on and grants MORE than the
-- real database does. service_role is left exactly as it is.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Privileges, stated from scratch
--
-- Every object is stripped of anon and authenticated first, then re-granted
-- from its own ACL. Grants alone are not enough: a fresh database hands new
-- tables in public to those roles by default privilege, so a baseline that
-- only adds grants leaves the defaults switched on and grants MORE than the
-- real database does. service_role is left exactly as it is.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Privileges, stated from scratch
--
-- Every object is stripped of anon and authenticated first, then re-granted
-- from its own ACL. Grants alone are not enough: a fresh database hands new
-- tables in public to those roles by default privilege, so a baseline that
-- only adds grants leaves the defaults switched on and grants MORE than the
-- real database does. service_role is left exactly as it is.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Privileges, stated from scratch
--
-- Every object is stripped of anon and authenticated first, then re-granted
-- from its own ACL. Grants alone are not enough: a fresh database hands new
-- tables in public to those roles by default privilege, so a baseline that
-- only adds grants leaves the defaults switched on and grants MORE than the
-- real database does. service_role is left exactly as it is.
-- ---------------------------------------------------------------------------
revoke all on table public."audit_logs" from anon, authenticated;
revoke all on sequence public."audit_logs_id_seq" from anon, authenticated;
revoke all on table public."conversations" from anon, authenticated;
revoke all on table public."curriculum_chunks" from anon, authenticated;
revoke all on table public."curriculum_documents" from anon, authenticated;
revoke all on table public."curriculum_sources" from anon, authenticated;
revoke all on table public."generation_runs" from anon, authenticated;
revoke all on table public."messages" from anon, authenticated;
revoke all on table public."profiles" from anon, authenticated;
revoke all on table public."project_item_versions" from anon, authenticated;
revoke all on table public."project_items" from anon, authenticated;
revoke all on table public."projects" from anon, authenticated;
revoke all on table public."student_alerts" from anon, authenticated;
revoke all on table public."student_grades" from anon, authenticated;
revoke all on table public."student_interventions" from anon, authenticated;
revoke all on table public."student_submissions" from anon, authenticated;
revoke all on table public."students" from anon, authenticated;
revoke all on table public."teacher_alert_settings" from anon, authenticated;
revoke all on table public."teacher_preferences" from anon, authenticated;
revoke all on table public."usage_quotas" from anon, authenticated;
revoke all on table public."user_roles" from anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."audit_logs" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."audit_logs" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."audit_logs" to service_role;
grant select, update, usage on sequence public."audit_logs_id_seq" to anon;
grant select, update, usage on sequence public."audit_logs_id_seq" to authenticated;
grant select, update, usage on sequence public."audit_logs_id_seq" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."conversations" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."conversations" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."conversations" to service_role;
-- curriculum_*: the ONLY tables in this block that are not granted table-wide.
--
-- The generator that produced this file emitted `grant ... to anon` for every
-- table it captured, and for the curriculum tables that re-opened exactly what
-- lines 858-860 revoke two hundred lines above. It also emitted the column-level
-- INSERT/SELECT/UPDATE grants further down, which is why the revoke appeared to
-- do nothing: a column ACL entry lives in pg_attribute.attacl and is untouched
-- by `revoke ... on table`.
--
-- 0017 re-closes both levels and is the authority on the intended state. This
-- block is edited to match, because the baseline job asserts that a database
-- rebuilt from this file alone has the same privilege surface as the test
-- project — and the two disagreeing is the failure this edit prevents.
--
-- anon: nothing. Curriculum text is not anonymous content, and no path in the
-- application reads it without a session.
-- authenticated: SELECT only. A signed-in teacher reads verified rows through
-- the verified-only policy; every write goes through the service role.
grant select on table public."curriculum_chunks" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."curriculum_chunks" to service_role;
grant select on table public."curriculum_documents" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."curriculum_documents" to service_role;
grant select on table public."curriculum_sources" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."curriculum_sources" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."generation_runs" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."generation_runs" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."generation_runs" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."messages" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."messages" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."messages" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."profiles" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."profiles" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."profiles" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_item_versions" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_item_versions" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_item_versions" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_items" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_items" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."project_items" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."projects" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."projects" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."projects" to service_role;
grant maintain, references, select, trigger, truncate on table public."student_alerts" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_alerts" to service_role;
grant delete, maintain, references, select, trigger, truncate, update on table public."student_grades" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_grades" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_interventions" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_interventions" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_submissions" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."student_submissions" to service_role;
grant insert, maintain, references, select, trigger, truncate on table public."students" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."students" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."teacher_alert_settings" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."teacher_alert_settings" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."teacher_preferences" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."teacher_preferences" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."teacher_preferences" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."usage_quotas" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."usage_quotas" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."usage_quotas" to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to service_role;
grant insert ("action", "actor_id", "actor_role", "after_val", "before_val", "created_at", "entity", "entity_id", "id", "ip_address") on table public."audit_logs" to authenticated;
grant select ("action", "actor_id", "actor_role", "after_val", "before_val", "created_at", "entity", "entity_id", "id", "ip_address") on table public."audit_logs" to authenticated;
grant insert ("archived_at", "created_at", "id", "subject", "title", "updated_at", "user_id") on table public."conversations" to authenticated;
grant select ("archived_at", "created_at", "id", "subject", "title", "updated_at", "user_id") on table public."conversations" to authenticated;
grant update ("archived_at", "created_at", "id", "subject", "title", "updated_at", "user_id") on table public."conversations" to authenticated;
-- curriculum_*: column-level grants deliberately omitted.
--
-- These are the entries that made the revoke at line 858 a no-op. A column grant
-- is a separate catalog row in pg_attribute.attacl, and `revoke ... on table`
-- does not touch it — so the table-wide revoke removed nothing that these lines
-- had created at column granularity. 0017 revokes them explicitly, and this file
-- no longer creates them, so the baseline and the test project agree.
--
-- The reader that needs these columns reads them through `grant select on table`
-- above, which covers every column that exists now and every one added later.
grant insert ("archived_at", "created_at", "id", "subject", "title", "updated_at", "user_id") on table public."conversations" to authenticated;
grant insert ("archived_at", "created_at", "id", "subject", "title", "updated_at", "user_id") on table public."conversations" to authenticated;
grant insert ("completed_at", "cost_actual", "cost_estimate", "created_at", "error_code", "id", "input_tokens", "latency_ms", "model", "output_tokens", "prompt_version", "provider", "status", "task_type", "user_id") on table public."generation_runs" to authenticated;
grant select ("completed_at", "cost_actual", "cost_estimate", "created_at", "error_code", "id", "input_tokens", "latency_ms", "model", "output_tokens", "prompt_version", "provider", "status", "task_type", "user_id") on table public."generation_runs" to authenticated;
grant update ("completed_at", "cost_actual", "cost_estimate", "created_at", "error_code", "id", "input_tokens", "latency_ms", "model", "output_tokens", "prompt_version", "provider", "status", "task_type", "user_id") on table public."generation_runs" to authenticated;
grant insert ("content", "conversation_id", "created_at", "generation_run_id", "id", "role", "user_id") on table public."messages" to authenticated;
grant select ("content", "conversation_id", "created_at", "generation_run_id", "id", "role", "user_id") on table public."messages" to authenticated;
grant update ("content", "conversation_id", "created_at", "generation_run_id", "id", "role", "user_id") on table public."messages" to authenticated;
grant insert ("avatar_url", "created_at", "email", "full_name", "grade", "id", "locale", "school_name", "stage", "subject", "updated_at") on table public."profiles" to authenticated;
grant select ("avatar_url", "created_at", "email", "full_name", "grade", "id", "locale", "school_name", "stage", "subject", "updated_at") on table public."profiles" to authenticated;
grant update ("avatar_url", "created_at", "email", "full_name", "grade", "id", "locale", "school_name", "stage", "subject", "updated_at") on table public."profiles" to authenticated;
grant insert ("content", "created_at", "id", "project_item_id", "user_id", "version_no") on table public."project_item_versions" to authenticated;
grant select ("content", "created_at", "id", "project_item_id", "user_id", "version_no") on table public."project_item_versions" to authenticated;
grant update ("content", "created_at", "id", "project_item_id", "user_id", "version_no") on table public."project_item_versions" to authenticated;
grant insert ("content", "created_at", "id", "item_type", "position", "project_id", "updated_at", "user_id") on table public."project_items" to authenticated;
grant select ("content", "created_at", "id", "item_type", "position", "project_id", "updated_at", "user_id") on table public."project_items" to authenticated;
grant update ("content", "created_at", "id", "item_type", "position", "project_id", "updated_at", "user_id") on table public."project_items" to authenticated;
grant insert ("created_at", "grade", "id", "kind", "stage", "status", "subject", "term", "title", "updated_at", "user_id") on table public."projects" to authenticated;
grant select ("created_at", "grade", "id", "kind", "stage", "status", "subject", "term", "title", "updated_at", "user_id") on table public."projects" to authenticated;
grant update ("created_at", "grade", "id", "kind", "stage", "status", "subject", "term", "title", "updated_at", "user_id") on table public."projects" to authenticated;
grant select ("alert_type", "assessment_count", "basis_count", "basis_kind", "created_at", "dedupe_key", "dismissed_at", "dismissed_reason", "evidence", "evidence_ids", "generation_run_id", "id", "is_read", "message", "prompt_version", "severity", "snoozed_until", "student_id", "suggested_action", "teacher_id") on table public."student_alerts" to authenticated;
grant update ("dismissed_at", "dismissed_reason", "is_read", "snoozed_until") on table public."student_alerts" to authenticated;
grant insert ("alert_type", "assessment_count", "basis_count", "basis_kind", "created_at", "dedupe_key", "dismissed_at", "dismissed_reason", "evidence", "evidence_ids", "generation_run_id", "id", "is_read", "message", "prompt_version", "severity", "snoozed_until", "student_id", "suggested_action", "teacher_id") on table public."student_alerts" to service_role;
grant select ("alert_type", "assessment_count", "basis_count", "basis_kind", "created_at", "dedupe_key", "dismissed_at", "dismissed_reason", "evidence", "evidence_ids", "generation_run_id", "id", "is_read", "message", "prompt_version", "severity", "snoozed_until", "student_id", "suggested_action", "teacher_id") on table public."student_alerts" to service_role;
grant update ("alert_type", "assessment_count", "basis_count", "basis_kind", "created_at", "dedupe_key", "dismissed_at", "dismissed_reason", "evidence", "evidence_ids", "generation_run_id", "id", "is_read", "message", "prompt_version", "severity", "snoozed_until", "student_id", "suggested_action", "teacher_id") on table public."student_alerts" to service_role;
grant select ("assessment_name", "created_at", "date", "id", "max_score", "score", "student_id", "subject", "teacher_id") on table public."student_grades" to authenticated;
grant update ("assessment_name", "created_at", "date", "id", "max_score", "score", "student_id", "subject", "teacher_id") on table public."student_grades" to authenticated;
grant insert ("assessment_name", "created_at", "date", "id", "max_score", "score", "student_id", "subject", "teacher_id") on table public."student_grades" to service_role;
grant select ("assessment_name", "created_at", "date", "id", "max_score", "score", "student_id", "subject", "teacher_id") on table public."student_grades" to service_role;
grant update ("assessment_name", "created_at", "date", "id", "max_score", "score", "student_id", "subject", "teacher_id") on table public."student_grades" to service_role;
grant insert ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to authenticated;
grant select ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to authenticated;
grant update ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to authenticated;
grant insert ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to service_role;
grant select ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to service_role;
grant update ("action", "alert_id", "created_at", "id", "occurred_on", "student_id", "subject", "teacher_id") on table public."student_interventions" to service_role;
grant insert ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to authenticated;
grant select ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to authenticated;
grant update ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to authenticated;
grant insert ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to service_role;
grant select ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to service_role;
grant update ("created_at", "date", "feedback", "id", "project_name", "status", "student_id", "subject", "teacher_id") on table public."student_submissions" to service_role;
grant insert ("class_label", "created_at", "deleted_at", "grade_level", "id", "name", "teacher_id", "updated_at") on table public."students" to authenticated;
grant select ("class_label", "created_at", "deleted_at", "grade_level", "id", "name", "teacher_id", "updated_at") on table public."students" to authenticated;
grant update ("class_label", "grade_level", "name") on table public."students" to authenticated;
grant insert ("class_label", "created_at", "deleted_at", "grade_level", "id", "name", "teacher_id", "updated_at") on table public."students" to service_role;
grant select ("class_label", "created_at", "deleted_at", "grade_level", "id", "name", "teacher_id", "updated_at") on table public."students" to service_role;
grant update ("class_label", "created_at", "deleted_at", "grade_level", "id", "name", "teacher_id", "updated_at") on table public."students" to service_role;
grant insert ("drop_threshold_pct", "missing_work_alerts", "teacher_id", "updated_at") on table public."teacher_alert_settings" to authenticated;
grant select ("drop_threshold_pct", "missing_work_alerts", "teacher_id", "updated_at") on table public."teacher_alert_settings" to authenticated;
grant update ("drop_threshold_pct", "missing_work_alerts") on table public."teacher_alert_settings" to authenticated;
grant insert ("drop_threshold_pct", "missing_work_alerts", "teacher_id", "updated_at") on table public."teacher_alert_settings" to service_role;
grant select ("drop_threshold_pct", "missing_work_alerts", "teacher_id", "updated_at") on table public."teacher_alert_settings" to service_role;
grant update ("drop_threshold_pct", "missing_work_alerts", "teacher_id", "updated_at") on table public."teacher_alert_settings" to service_role;
grant insert ("content_locale", "created_at", "digit_style", "explanation_style", "ui_locale", "updated_at", "user_id") on table public."teacher_preferences" to authenticated;
grant select ("content_locale", "created_at", "digit_style", "explanation_style", "ui_locale", "updated_at", "user_id") on table public."teacher_preferences" to authenticated;
grant update ("content_locale", "created_at", "digit_style", "explanation_style", "ui_locale", "updated_at", "user_id") on table public."teacher_preferences" to authenticated;
grant insert ("period_start", "runs_limit", "runs_used", "tokens_limit", "tokens_used", "updated_at", "user_id") on table public."usage_quotas" to authenticated;
grant select ("period_start", "runs_limit", "runs_used", "tokens_limit", "tokens_used", "updated_at", "user_id") on table public."usage_quotas" to authenticated;
grant update ("period_start", "runs_limit", "runs_used", "tokens_limit", "tokens_used", "updated_at", "user_id") on table public."usage_quotas" to authenticated;
grant select ("granted_at", "granted_by", "id", "role", "user_id") on table public."user_roles" to authenticated;
revoke all on function public."admin_read_student"(p_student_id uuid, p_reason text) from anon, authenticated;
revoke all on function public."alert_basis_is_consistent"(p_alert uuid) from anon, authenticated;
revoke all on function public."handle_new_user"() from anon, authenticated;
revoke all on function public."has_privilege_probe"(p_role text, p_table text, p_privilege text, p_column text) from anon, authenticated;
revoke all on function public."has_role"(p_user_id uuid, p_role app_role) from anon, authenticated;
revoke all on function public."is_admin"(p_user_id uuid) from anon, authenticated;
revoke all on function public."is_staff"(p_user_id uuid) from anon, authenticated;
revoke all on function public."purge_deleted_students"() from anon, authenticated;
revoke all on function public."purge_expired_students_job"() from anon, authenticated;
revoke all on function public."restore_student"(p_student_id uuid) from anon, authenticated;
revoke all on function public."set_owner_teacher"() from anon, authenticated;
revoke all on function public."soft_delete_student"(p_student_id uuid) from anon, authenticated;
revoke all on function public."students_is_active"(p_id uuid, p_teacher uuid) from anon, authenticated;
revoke all on function public."tg_set_updated_at"() from anon, authenticated;
revoke all on function public."touch_updated_at"() from anon, authenticated;
grant execute on function public."admin_read_student"(p_student_id uuid, p_reason text) to authenticated;
grant execute on function public."admin_read_student"(p_student_id uuid, p_reason text) to service_role;
grant execute on function public."alert_basis_is_consistent"(p_alert uuid) to authenticated;
grant execute on function public."alert_basis_is_consistent"(p_alert uuid) to service_role;
grant execute on function public."citext"(boolean) to anon;
grant execute on function public."citext"(boolean) to authenticated;
grant execute on function public."citext"(boolean) to service_role;
grant execute on function public."citext"(inet) to anon;
grant execute on function public."citext"(inet) to authenticated;
grant execute on function public."citext"(inet) to service_role;
grant execute on function public."citext"(character) to anon;
grant execute on function public."citext"(character) to authenticated;
grant execute on function public."citext"(character) to service_role;
grant execute on function public."citext_cmp"(citext, citext) to anon;
grant execute on function public."citext_cmp"(citext, citext) to authenticated;
grant execute on function public."citext_cmp"(citext, citext) to service_role;
grant execute on function public."citext_eq"(citext, citext) to anon;
grant execute on function public."citext_eq"(citext, citext) to authenticated;
grant execute on function public."citext_eq"(citext, citext) to service_role;
grant execute on function public."citext_ge"(citext, citext) to anon;
grant execute on function public."citext_ge"(citext, citext) to authenticated;
grant execute on function public."citext_ge"(citext, citext) to service_role;
grant execute on function public."citext_gt"(citext, citext) to anon;
grant execute on function public."citext_gt"(citext, citext) to authenticated;
grant execute on function public."citext_gt"(citext, citext) to service_role;
grant execute on function public."citext_hash"(citext) to anon;
grant execute on function public."citext_hash"(citext) to authenticated;
grant execute on function public."citext_hash"(citext) to service_role;
grant execute on function public."citext_hash_extended"(citext, bigint) to anon;
grant execute on function public."citext_hash_extended"(citext, bigint) to authenticated;
grant execute on function public."citext_hash_extended"(citext, bigint) to service_role;
grant execute on function public."citext_larger"(citext, citext) to anon;
grant execute on function public."citext_larger"(citext, citext) to authenticated;
grant execute on function public."citext_larger"(citext, citext) to service_role;
grant execute on function public."citext_le"(citext, citext) to anon;
grant execute on function public."citext_le"(citext, citext) to authenticated;
grant execute on function public."citext_le"(citext, citext) to service_role;
grant execute on function public."citext_lt"(citext, citext) to anon;
grant execute on function public."citext_lt"(citext, citext) to authenticated;
grant execute on function public."citext_lt"(citext, citext) to service_role;
grant execute on function public."citext_ne"(citext, citext) to anon;
grant execute on function public."citext_ne"(citext, citext) to authenticated;
grant execute on function public."citext_ne"(citext, citext) to service_role;
grant execute on function public."citext_pattern_cmp"(citext, citext) to anon;
grant execute on function public."citext_pattern_cmp"(citext, citext) to authenticated;
grant execute on function public."citext_pattern_cmp"(citext, citext) to service_role;
grant execute on function public."citext_pattern_ge"(citext, citext) to anon;
grant execute on function public."citext_pattern_ge"(citext, citext) to authenticated;
grant execute on function public."citext_pattern_ge"(citext, citext) to service_role;
grant execute on function public."citext_pattern_gt"(citext, citext) to anon;
grant execute on function public."citext_pattern_gt"(citext, citext) to authenticated;
grant execute on function public."citext_pattern_gt"(citext, citext) to service_role;
grant execute on function public."citext_pattern_le"(citext, citext) to anon;
grant execute on function public."citext_pattern_le"(citext, citext) to authenticated;
grant execute on function public."citext_pattern_le"(citext, citext) to service_role;
grant execute on function public."citext_pattern_lt"(citext, citext) to anon;
grant execute on function public."citext_pattern_lt"(citext, citext) to authenticated;
grant execute on function public."citext_pattern_lt"(citext, citext) to service_role;
grant execute on function public."citext_smaller"(citext, citext) to anon;
grant execute on function public."citext_smaller"(citext, citext) to authenticated;
grant execute on function public."citext_smaller"(citext, citext) to service_role;
grant execute on function public."citextin"(cstring) to anon;
grant execute on function public."citextin"(cstring) to authenticated;
grant execute on function public."citextin"(cstring) to service_role;
grant execute on function public."citextout"(citext) to anon;
grant execute on function public."citextout"(citext) to authenticated;
grant execute on function public."citextout"(citext) to service_role;
grant execute on function public."citextrecv"(internal) to anon;
grant execute on function public."citextrecv"(internal) to authenticated;
grant execute on function public."citextrecv"(internal) to service_role;
grant execute on function public."citextsend"(citext) to anon;
grant execute on function public."citextsend"(citext) to authenticated;
grant execute on function public."citextsend"(citext) to service_role;
grant execute on function public."handle_new_user"() to anon;
grant execute on function public."handle_new_user"() to authenticated;
grant execute on function public."handle_new_user"() to service_role;
grant execute on function public."has_privilege_probe"(p_role text, p_table text, p_privilege text, p_column text) to authenticated;
grant execute on function public."has_privilege_probe"(p_role text, p_table text, p_privilege text, p_column text) to service_role;
grant execute on function public."has_role"(p_user_id uuid, p_role app_role) to anon;
grant execute on function public."has_role"(p_user_id uuid, p_role app_role) to authenticated;
grant execute on function public."has_role"(p_user_id uuid, p_role app_role) to service_role;
grant execute on function public."is_admin"(p_user_id uuid) to anon;
grant execute on function public."is_admin"(p_user_id uuid) to authenticated;
grant execute on function public."is_admin"(p_user_id uuid) to service_role;
grant execute on function public."is_staff"(p_user_id uuid) to anon;
grant execute on function public."is_staff"(p_user_id uuid) to authenticated;
grant execute on function public."is_staff"(p_user_id uuid) to service_role;
grant execute on function public."purge_deleted_students"() to service_role;
grant execute on function public."purge_expired_students_job"() to service_role;
grant execute on function public."regexp_match"(citext, citext) to anon;
grant execute on function public."regexp_match"(citext, citext) to authenticated;
grant execute on function public."regexp_match"(citext, citext) to service_role;
grant execute on function public."regexp_match"(citext, citext, text) to anon;
grant execute on function public."regexp_match"(citext, citext, text) to authenticated;
grant execute on function public."regexp_match"(citext, citext, text) to service_role;
grant execute on function public."regexp_matches"(citext, citext) to anon;
grant execute on function public."regexp_matches"(citext, citext) to authenticated;
grant execute on function public."regexp_matches"(citext, citext) to service_role;
grant execute on function public."regexp_matches"(citext, citext, text) to anon;
grant execute on function public."regexp_matches"(citext, citext, text) to authenticated;
grant execute on function public."regexp_matches"(citext, citext, text) to service_role;
grant execute on function public."regexp_replace"(citext, citext, text) to anon;
grant execute on function public."regexp_replace"(citext, citext, text) to authenticated;
grant execute on function public."regexp_replace"(citext, citext, text) to service_role;
grant execute on function public."regexp_replace"(citext, citext, text, text) to anon;
grant execute on function public."regexp_replace"(citext, citext, text, text) to authenticated;
grant execute on function public."regexp_replace"(citext, citext, text, text) to service_role;
grant execute on function public."regexp_split_to_array"(citext, citext) to anon;
grant execute on function public."regexp_split_to_array"(citext, citext) to authenticated;
grant execute on function public."regexp_split_to_array"(citext, citext) to service_role;
grant execute on function public."regexp_split_to_array"(citext, citext, text) to anon;
grant execute on function public."regexp_split_to_array"(citext, citext, text) to authenticated;
grant execute on function public."regexp_split_to_array"(citext, citext, text) to service_role;
grant execute on function public."regexp_split_to_table"(citext, citext) to anon;
grant execute on function public."regexp_split_to_table"(citext, citext) to authenticated;
grant execute on function public."regexp_split_to_table"(citext, citext) to service_role;
grant execute on function public."regexp_split_to_table"(citext, citext, text) to anon;
grant execute on function public."regexp_split_to_table"(citext, citext, text) to authenticated;
grant execute on function public."regexp_split_to_table"(citext, citext, text) to service_role;
grant execute on function public."replace"(citext, citext, citext) to anon;
grant execute on function public."replace"(citext, citext, citext) to authenticated;
grant execute on function public."replace"(citext, citext, citext) to service_role;
grant execute on function public."restore_student"(p_student_id uuid) to authenticated;
grant execute on function public."restore_student"(p_student_id uuid) to service_role;
-- search_curriculum_text: retrieval function, EXECUTE to authenticated only
-- (anon explicitly revoked from the PUBLIC default; it appears nowhere in
-- anon-execute-allowlist.txt).
revoke all on function public."search_curriculum_text"(p_subject text, p_grade_level smallint, p_lesson_topic text, p_term smallint, p_limit integer) from public, anon;
grant execute on function public."search_curriculum_text"(p_subject text, p_grade_level smallint, p_lesson_topic text, p_term smallint, p_limit integer) to authenticated;
grant execute on function public."search_curriculum_text"(p_subject text, p_grade_level smallint, p_lesson_topic text, p_term smallint, p_limit integer) to service_role;
grant execute on function public."set_owner_teacher"() to anon;
grant execute on function public."set_owner_teacher"() to authenticated;
grant execute on function public."set_owner_teacher"() to service_role;
grant execute on function public."soft_delete_student"(p_student_id uuid) to authenticated;
grant execute on function public."soft_delete_student"(p_student_id uuid) to service_role;
grant execute on function public."split_part"(citext, citext, integer) to anon;
grant execute on function public."split_part"(citext, citext, integer) to authenticated;
grant execute on function public."split_part"(citext, citext, integer) to service_role;
grant execute on function public."strpos"(citext, citext) to anon;
grant execute on function public."strpos"(citext, citext) to authenticated;
grant execute on function public."strpos"(citext, citext) to service_role;
grant execute on function public."students_is_active"(p_id uuid, p_teacher uuid) to authenticated;
grant execute on function public."students_is_active"(p_id uuid, p_teacher uuid) to service_role;
grant execute on function public."texticlike"(citext, text) to anon;
grant execute on function public."texticlike"(citext, text) to authenticated;
grant execute on function public."texticlike"(citext, text) to service_role;
grant execute on function public."texticlike"(citext, citext) to anon;
grant execute on function public."texticlike"(citext, citext) to authenticated;
grant execute on function public."texticlike"(citext, citext) to service_role;
grant execute on function public."texticnlike"(citext, text) to anon;
grant execute on function public."texticnlike"(citext, text) to authenticated;
grant execute on function public."texticnlike"(citext, text) to service_role;
grant execute on function public."texticnlike"(citext, citext) to anon;
grant execute on function public."texticnlike"(citext, citext) to authenticated;
grant execute on function public."texticnlike"(citext, citext) to service_role;
grant execute on function public."texticregexeq"(citext, text) to anon;
grant execute on function public."texticregexeq"(citext, text) to authenticated;
grant execute on function public."texticregexeq"(citext, text) to service_role;
grant execute on function public."texticregexeq"(citext, citext) to anon;
grant execute on function public."texticregexeq"(citext, citext) to authenticated;
grant execute on function public."texticregexeq"(citext, citext) to service_role;
grant execute on function public."texticregexne"(citext, text) to anon;
grant execute on function public."texticregexne"(citext, text) to authenticated;
grant execute on function public."texticregexne"(citext, text) to service_role;
grant execute on function public."texticregexne"(citext, citext) to anon;
grant execute on function public."texticregexne"(citext, citext) to authenticated;
grant execute on function public."texticregexne"(citext, citext) to service_role;
grant execute on function public."tg_set_updated_at"() to anon;
grant execute on function public."tg_set_updated_at"() to authenticated;
grant execute on function public."tg_set_updated_at"() to service_role;
grant execute on function public."touch_updated_at"() to anon;
grant execute on function public."touch_updated_at"() to authenticated;
grant execute on function public."touch_updated_at"() to service_role;
grant execute on function public."translate"(citext, citext, text) to anon;
grant execute on function public."translate"(citext, citext, text) to authenticated;
grant execute on function public."translate"(citext, citext, text) to service_role;
-- PUBLIC keeps EXECUTE only where the test project still grants it.
revoke all on function public."admin_read_student"(p_student_id uuid, p_reason text) from public;
revoke all on function public."alert_basis_is_consistent"(p_alert uuid) from public;
revoke all on function public."has_privilege_probe"(p_role text, p_table text, p_privilege text, p_column text) from public;
revoke all on function public."purge_deleted_students"() from public;
revoke all on function public."purge_expired_students_job"() from public;
revoke all on function public."restore_student"(p_student_id uuid) from public;
revoke all on function public."soft_delete_student"(p_student_id uuid) from public;
revoke all on function public."students_is_active"(p_id uuid, p_teacher uuid) from public;

commit;
