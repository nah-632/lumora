-- 0015_set_owner_reject_spoof.sql — refuse a forged owner instead of silently rewriting it
--
-- 0013 assigned ownership with `new.teacher_id := auth.uid()` unconditionally.
-- 0014 fixed the case with no session (service_role, admin and fixture paths),
-- where that assignment turned an explicit teacher_id into NULL and failed the
-- insert with 23502.
--
-- What neither version decided is what to do when a *client* names an owner that
-- is not itself. 0013 rewrote the value to the caller, so the forged insert
-- succeeded and the row landed under the attacker. That is safe for data
-- integrity but wrong as a signal: the request was never legitimate, and
-- answering 201 tells the caller the attempt worked. The isolation suite says
-- the same thing from the other side — "A cannot create a student owned by B
-- (explicit teacher_id refused)" asserts a refusal, and an unwrapped rewrite
-- returns 201 instead.
--
-- This migration makes the three cases explicit:
--
--   no session        -> return the row unchanged; NOT NULL and the profiles
--                        foreign key decide, because there is no caller to
--                        attribute anything to
--   session, no owner -> attribute to the caller (the normal client insert)
--   session, other    -> raise 42501, so the attempt is refused rather than
--                        laundered
--
-- Raising in a BEFORE INSERT trigger aborts the statement, so no row is written
-- at all. errcode 42501 (insufficient_privilege) is what PostgREST renders as
-- HTTP 403, which is the status the suite asserts.
--
-- Relationship to the known gap in ADR-012: an omitted teacher_id is still
-- accepted and attributed to the caller, which is the documented xfail. This
-- migration does not change that path.
--
-- Triggers, grants and revokes are untouched: the same six `*_set_owner`
-- triggers call this same function, and the column grants from 0013 stand.

create or replace function public.set_owner_teacher()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  -- No end-user session: service_role, the admin API and fixture paths. There is
  -- nobody to attribute the row to, so leave the supplied value alone.
  if caller is null then
    return new;
  end if;

  -- A normal client insert that let the server choose the owner.
  if new.teacher_id is null then
    new.teacher_id := caller;
    return new;
  end if;

  -- The client named someone else. Refuse; do not silently correct it.
  if new.teacher_id <> caller then
    raise exception
      'refusing to create a row owned by another teacher'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.set_owner_teacher() is
  'BEFORE INSERT: attributes a row to the caller when the client omitted teacher_id, and raises 42501 when the client names a different owner. With no session (service_role, fixture and admin paths) the supplied value is left for NOT NULL and the profiles foreign key to judge. See ADR-012.';