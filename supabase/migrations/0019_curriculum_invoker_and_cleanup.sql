-- 0019_curriculum_invoker_and_cleanup.sql
--
-- Three corrections to 0017, all raised in review.
--
-- 1. search_curriculum_text() was SECURITY DEFINER. It ran as its owner, so the
--    verified-only RLS policies were never consulted for the caller and the
--    ONLY thing keeping unverified text out of a prompt was the WHERE clause
--    inside the function. That works, but it leaves one guard where there could
--    be two: a future edit to the body silently becomes the whole defence.
--    As SECURITY INVOKER the function runs as the caller, so RLS applies on top
--    of the body's own filter. The `source_kind = 'official'` predicate stays in
--    the body either way, because RLS filters on verification only — being
--    verified is not the same as being official.
--
-- 2. pedagogical_activities is dropped. It was created ahead of need: zero rows,
--    no reader in the application, no writer outside the service role. A table
--    with a staff-write policy and no consumer is surface area with no product
--    behind it.
--
--    The trigger that would have maintained its updated_at is therefore NOT
--    added: dropping the table in the same migration makes it moot.
--
-- 3. curriculum_sources gains verification_note, so the basis of a verification
--    can be recorded as prose. `verified_by` stays NULL and stays uuid — it has
--    a foreign key to auth.users and cannot hold a label. The note says what was
--    checked and by whom it still needs confirming.
--
-- Re-runnable: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. search_curriculum_text: DEFINER -> INVOKER
--
-- ALTER rather than CREATE OR REPLACE for the attribute: CREATE OR REPLACE
-- keeps the existing security attribute unless it is restated, and an ALTER is
-- unambiguous about the change being made. The body is untouched — the
-- verified_at and source_kind filters remain exactly as 0017 wrote them.
-- ---------------------------------------------------------------------------
alter function public.search_curriculum_text(text, smallint, text, smallint, integer)
  security invoker;

-- The invoker path needs the caller to hold SELECT on all three tables the body
-- reads. 0017 granted exactly that to authenticated; restated here so the
-- requirement is visible next to the change that depends on it.
grant select on public.curriculum_sources to authenticated;
grant select on public.curriculum_documents to authenticated;
grant select on public.curriculum_chunks to authenticated;

-- ACL unchanged: anon none, authenticated and service_role EXECUTE.
revoke all on function public.search_curriculum_text(text, smallint, text, smallint, integer)
  from public, anon;
grant execute on function public.search_curriculum_text(text, smallint, text, smallint, integer)
  to authenticated;
grant execute on function public.search_curriculum_text(text, smallint, text, smallint, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Drop pedagogical_activities
--
-- Its four policies and its grants go with it; there is nothing to revoke
-- afterwards. Dropped rather than archived because it holds no rows and nothing
-- reads it, so there is no history to preserve.
-- ---------------------------------------------------------------------------
drop table if exists public.pedagogical_activities;

-- ---------------------------------------------------------------------------
-- 3. verification_note
--
-- Nullable on purpose: most rows have not been verified at all, and a NOT NULL
-- column would force a placeholder that reads like a statement of fact.
-- ---------------------------------------------------------------------------
alter table public.curriculum_sources
  add column if not exists verification_note text;

comment on column public.curriculum_sources.verification_note is
  'Prose record of how a source was verified and what remains unconfirmed. Not a substitute for verified_by, which is an auth.users reference and is NULL when no person has signed off.';

update public.curriculum_sources
   set verification_note = 'agent HTTP check only (title and footer); owner to confirm'
 where base_url = 'https://www.edunet.bh'
   and verification_note is null;

-- verified_by stays NULL for every seeded row: the column types as uuid and
-- references auth.users(id), so no label can be stored there.