-- 0016_function_grants_align.sql — apply the function revokes 0010 already ordered
--
-- 0010 and 0013 specify a set of `revoke all on function ...` statements. They are
-- in those files, but they never reached the database: on the test project anon and
-- PUBLIC still hold EXECUTE on five SECURITY DEFINER functions and on
-- students_is_active. This migration is not a new decision — it is the same
-- statements, applied.
--
-- Measured on the test project before this file existed:
--
--   anon -> rpc/purge_deleted_students       HTTP 200
--   anon -> rpc/purge_expired_students_job   HTTP 204
--
-- Both are SECURITY DEFINER with no role check inside, so they run with the
-- owner's rights and bypass RLS. An unauthenticated caller could trigger a
-- permanent purge of soft-deleted student records. Nothing was destroyed only
-- because the test project had no rows old enough to purge.
--
-- admin_read_student() is the same drift without the same impact: it is SECURITY
-- DEFINER too, but it checks has_role(caller,'admin') before it reads anything and
-- writes an audit row. Measured: anon 401/42501, an ordinary teacher 403/42501,
-- zero rows returned in both cases. The grant is still wrong — a function that
-- must never be callable by anon should not be callable by anon, whatever its body
-- checks — but it was not exploitable.
--
-- Re-runnable: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. The admin read path: authenticated only (0010:426)
-- ---------------------------------------------------------------------------
revoke all on function public.admin_read_student(uuid, text) from public, anon;
grant execute on function public.admin_read_student(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The purge jobs: nobody but the owner (0010:435-436)
--
-- These are the dangerous ones. No role check inside, SECURITY DEFINER, and they
-- delete rows permanently.
-- ---------------------------------------------------------------------------
revoke all on function public.purge_deleted_students() from public, anon, authenticated;
revoke all on function public.purge_expired_students_job() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Soft delete and restore: a signed-in teacher only (0010:439-440)
-- ---------------------------------------------------------------------------
revoke all on function public.soft_delete_student(uuid) from anon, public;
revoke all on function public.restore_student(uuid) from anon, public;
grant execute on function public.soft_delete_student(uuid) to authenticated;
grant execute on function public.restore_student(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. students_is_active: authenticated MUST keep EXECUTE
--
-- Every child-table RLS policy calls it, so revoking it from authenticated breaks
-- the whole suite with 42501 — 0010 says so in a comment, learned by running the
-- tests rather than by reading the SQL. Only PUBLIC and anon are closed here.
-- ---------------------------------------------------------------------------
revoke all on function public.students_is_active(uuid, uuid) from public, anon;
grant execute on function public.students_is_active(uuid, uuid) to authenticated;