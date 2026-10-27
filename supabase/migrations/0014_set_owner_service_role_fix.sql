-- 0014_set_owner_service_role_fix.sql — ownership trigger must not fire without a session
--
-- 0013 assigned ownership with a BEFORE INSERT trigger:
--
--     new.teacher_id := (select auth.uid());
--
-- which is correct for a browser session and wrong for everything else. For any
-- connection that carries no end-user JWT — service_role, and the admin and
-- fixture paths built on it — auth.uid() is NULL, so the trigger overwrites an
-- explicit teacher_id with NULL and the insert dies on NOT NULL:
--
--     ERROR 23502: null value in column "teacher_id" of relation "students"
--
-- Measured on the test project: a service_role insert of a student with a valid
-- teacher_id returns 23502 and no row. That is not a security property, it is an
-- outage of the only path that can create fixtures, and it is what turned the
-- isolation suite from "28/30 passed" into a crash during setup.
--
-- The security property 0013 wanted is preserved exactly: a *client* still
-- cannot choose the owner, because any request that arrives with a user JWT has
-- auth.uid() set and still has teacher_id overwritten. Only the case where there
-- is no user at all is left alone, and in that case the column's own NOT NULL
-- and the foreign key to profiles are what decide — not a client's claim.
--
-- This is a widening of who may supply the value, so it is written as its own
-- migration rather than an edit of 0013: 0013 is already applied in every
-- environment, and rewriting an applied migration makes the repo and the
-- databases disagree about what ran.

create or replace function public.set_owner_teacher()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only a real session may be forced. With no JWT there is no owner to force,
  -- and overwriting with NULL would reject the insert rather than protect it.
  if (select auth.uid()) is not null then
    new.teacher_id := (select auth.uid());
  end if;
  return new;
end;
$$;

comment on function public.set_owner_teacher() is
  'BEFORE INSERT: forces teacher_id to the caller when a user session exists. A client-sent owner is discarded, never trusted. With no session (service_role, fixture and admin paths) the supplied value is left for NOT NULL and the profiles foreign key to judge.';

-- No grant, trigger or policy changes: the same triggers call this same
-- function, and the column grants and revokes from 0013 stay exactly as they are.