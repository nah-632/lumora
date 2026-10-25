-- 0013_alert_write_path.sql — close the alert write path and remove the default
--
-- Two defects found by reading the write path after the canary reported that a
-- permissive INSERT policy on student_grades wrote nothing (see ADR-012):
--
-- 1. student_alerts was granted table-wide INSERT and UPDATE to `authenticated`
--    in 0010, while the accompanying comment claimed column-level control. The
--    UPDATE policy checks only teacher_id, so a teacher could rewrite the text
--    of their own alert, its severity, or basis_count/basis_kind/evidence_ids.
--    basis_count is the number the UI renders as "Based on N assessments"; a
--    client that can write it can make that sentence false. It is computed
--    server-side by design (ADR-004, constitution 7.1) and must not be writable
--    from a browser session.
--
-- 2. teacher_id defaulted to auth.uid(), which assigns ownership in a column
--    default. Postgres evaluates a default before the INSERT policy, and on this
--    stack the measured behaviour (ADR-012) is that an omitted teacher_id can be
--    accepted without the policy being consulted. Ownership is now assigned by a
--    BEFORE INSERT trigger, which runs before the policy is evaluated, so the
--    policy always sees the final value. The policy is then the only thing that
--    decides, which is what makes the canary able to break it.
--
-- Re-runnable: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. Ownership is assigned by a trigger, not by a column default
-- ---------------------------------------------------------------------------
create or replace function public.set_owner_teacher()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  -- A client may not choose the owner. Whatever it sent is overwritten with the
  -- caller's identity; the INSERT policy then compares teacher_id = auth.uid(),
  -- which is now a comparison of a final, committed value against the session.
  new.teacher_id := (select auth.uid());
  return new;
end;
$$;

comment on function public.set_owner_teacher() is
  'BEFORE INSERT: forces teacher_id to the caller. A client-sent owner is discarded, never trusted.';

do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'student_grades', 'student_submissions',
    'student_alerts', 'student_interventions', 'teacher_alert_settings'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_owner', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_owner_teacher()',
      t || '_set_owner', t
    );
    -- The default is now redundant, and a default is what made the policy blind
    -- to the final value. Removing it means there is exactly one place that
    -- decides ownership.
    execute format('alter table public.%I alter column teacher_id drop default', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. student_alerts: a teacher may set the flags, and nothing else
--
-- The INSERT path is closed for the same reason: an alert is generated
-- server-side, and a client-written row would carry a client-written
-- basis_count, which is the same lie by a different route.
-- ---------------------------------------------------------------------------
revoke insert, update on public.student_alerts from authenticated;
grant update (is_read, snoozed_until, dismissed_at, dismissed_reason)
  on public.student_alerts to authenticated;

comment on table public.student_alerts is
  'Generated server-side (service_role). A teacher may only mark read, snooze or dismiss with a reason; message, severity, basis_count, basis_kind and evidence_ids are not client-writable.';

-- The same reasoning applies to the flags on the student record itself: 0010
-- already used a column grant there, and this restates it so the two tables
-- cannot drift apart.
revoke update on public.students from authenticated;
grant update (name, grade_level, class_label) on public.students to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The basis pair must survive a future write path
--
-- basis_count and basis_kind are set together (0012). A trigger-level guard is
-- not needed while no client can write them, but evidence_ids and basis_count
-- must always describe the same rows; this view is what the evidence job reads,
-- so a writer that sets one without the other becomes visible rather than silent.
-- ---------------------------------------------------------------------------
create or replace function public.has_privilege_probe(
  p_role text,
  p_table text,
  p_privilege text,
  p_column text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

comment on function public.has_privilege_probe(text, text, text, text) is
  'Read-only privilege introspection for the isolation suite. SECURITY DEFINER because authenticated cannot call has_table_privilege() for another role; it can only ever READ the catalogue, and every argument is validated first.';

revoke all on function public.has_privilege_probe(text, text, text, text) from public, anon;
grant execute on function public.has_privilege_probe(text, text, text, text) to authenticated, service_role;

create or replace function public.alert_basis_is_consistent(p_alert uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    (select a.basis_count is null
         or a.basis_count = coalesce(array_length(a.evidence_ids, 1), 0)
     from public.student_alerts a
     where a.id = p_alert),
    false
  );
$$;

comment on function public.alert_basis_is_consistent(uuid) is
  'True when basis_count matches the number of rows named in evidence_ids (or both are absent).';

revoke all on function public.alert_basis_is_consistent(uuid) from public, anon;
grant execute on function public.alert_basis_is_consistent(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Grants the assertions in tests/security/isolation.mjs rely on
--
-- service_role keeps the full write path (it is the generator), restated here
-- so the revoke above cannot silently remove the server's ability to write.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.student_alerts to service_role;