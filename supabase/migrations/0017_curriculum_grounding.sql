-- 0017_curriculum_grounding.sql — make the curriculum tables hold text a
-- retrieval step can actually quote, and close the read path to verified rows.
--
-- Three separate defects are addressed here, and only the first is obvious.
--
-- 1. THE TABLES COULD NOT STORE LESSON CONTENT THAT MATTERS.
--    `curriculum_sources` describes a book: publisher, stage, subject, edition.
--    `curriculum_documents` describes a part of it: unit, page range.
--    `curriculum_chunks` holds prose, but is reachable only through a document,
--    and a document carries no notion of a lesson topic, a term, or whether
--    anyone has checked its contents. There is nowhere to record "this is the
--    verified learning outcome for التحليل إلى العوامل, term 2" — which is the
--    only kind of row a grounded lesson plan can cite. The columns added below
--    are that place.
--
-- 2. THE READ PATH WAS OPEN TO EVERYTHING.
--    `curriculum_sources_select_auth`, `curriculum_docs_select_auth` and
--    `curriculum_chunks_select_auth` are all `using (true)`. Any signed-in
--    teacher reads every row, including rows nobody has ever checked. A table of
--    unverified curriculum material that is indistinguishable from verified
--    material at the database layer will eventually be quoted as though it were
--    authoritative. `verified_at` is nullable by design and NULL means
--    "unverified"; the policies below make NULL invisible.
--
-- 3. THE GRANTS WERE TABLE-WIDE AND COLUMN-WIDE.
--    `0000_baseline.sql` issues `revoke all on table public."curriculum_sources"
--    from anon, authenticated` and then, forty lines later in the same file,
--    `grant delete, insert, maintain, references, select, trigger, truncate,
--    update on table public."curriculum_sources" to anon`.
--
--    The revoke is a no-op and cannot be repaired at table level. On the test
--    project, `authenticated` holds column-level INSERT/SELECT/UPDATE on every
--    column, and `aclexplode(c.relacl)` shows none of it: a column ACL entry is
--    a separate catalog row in `pg_attribute.attacl`. `revoke ... on table`
--    removes table-level entries only. Measured on adpxqdrkbgzdldeixuge: anon
--    holds delete, insert, maintain, references, select, trigger, truncate and
--    update on all three curriculum tables, which is exactly what
--    `supabase/tests/expected-grants.txt` records — the snapshot is faithful to
--    a state the migrations never intended.
--
--    This file therefore revokes at BOTH levels in the right order: the
--    table-wide grant first, then the column grants, because revoking at column
--    granularity is the only thing that removes a `pg_attribute.attacl` entry.
--
-- WHY REVOKING MATTERS EVEN WITH RLS ON: RLS decides which rows a privileged
-- role may touch; it does not decide what the role may attempt. An `anon` client
-- holding INSERT on a table with no INSERT policy gets an error rather than a
-- write, so the layer held — but the privilege surface is larger than the design
-- and `expected-grants.txt` was ratifying the gap rather than reporting it.
--
-- Re-runnable: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- 1. source_kind — official or not, as a type rather than a convention
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'curriculum_source_kind') then
    create type public.curriculum_source_kind as enum ('official', 'supplementary_unverified');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. curriculum_sources — what the source IS, and where it lives
--
-- `verified_at` / `verified_by` already exist on this table (baseline:126-127);
-- they are what the verified-only read policy filters on. `source_kind` is new
-- because "official" is not derivable from publisher or status: a Ministry PDF
-- and a commercially published workbook can both be `approved`.
-- ---------------------------------------------------------------------------
alter table public.curriculum_sources
  add column if not exists source_kind public.curriculum_source_kind not null
    default 'supplementary_unverified'::public.curriculum_source_kind,
  add column if not exists base_url text;

comment on column public.curriculum_sources.source_kind is
  'official = published by the Ministry of Education or a government portal. supplementary_unverified = anything else, regardless of how useful it looks. Defaults to the safe value so a row inserted without an explicit kind can never be mistaken for official.';

comment on column public.curriculum_sources.base_url is
  'The source landing page. This is the ONLY url the application may show a teacher, and it is read from this column — never from model output. See src/lib/ai/curriculum.ts.';

comment on column public.curriculum_sources.verified_at is
  'NULL means unverified. An unverified source is invisible to every non-staff reader, so it cannot be retrieved into a prompt. Set by scripts/verify-curriculum-links.mjs after a human confirms the URL resolves and is what it claims to be.';

-- ---------------------------------------------------------------------------
-- 3. curriculum_documents — which lesson this document is, and for whom
--
-- The retrieval query matches on (subject, grade_level, lesson_topic, term).
-- `subject` and `stage` live on the parent source, so only the lesson-scoped
-- fields are needed here; the join is in `search_curriculum_text()` below.
--
-- `grade_level` is smallint to match `students.grade_level` (same 7/8/9 domain,
-- same reasoning: a string would admit "grade seven"), but nullable, because a
-- primary-stage document has no secondary grade.
-- ---------------------------------------------------------------------------
alter table public.curriculum_documents
  add column if not exists lesson_topic text,
  add column if not exists learning_outcomes_text text,
  add column if not exists term smallint,
  add column if not exists grade_level smallint,
  add column if not exists unit_number integer;

comment on column public.curriculum_documents.learning_outcomes_text is
  'The verbatim outcome text, as published. This is the field retrieval returns and the field a prompt quotes. Free text from an untrusted source: it is escaped and fenced before it reaches a model, and it is never treated as an instruction.';

comment on column public.curriculum_documents.lesson_topic is
  'The specific lesson this text belongs to, in the language the curriculum publishes it (e.g. التحليل إلى العوامل). NULL means the document is scoped to the whole unit or subject and matches only a broad retrieval query — see search_curriculum_text().';

comment on column public.curriculum_documents.term is
  '1, 2 or 3. NULL means the document is not term-specific; it is then eligible for any term rather than being excluded from every one.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'curriculum_documents_term_check'
  ) then
    alter table public.curriculum_documents
      add constraint curriculum_documents_term_check
      check (term is null or term between 1 and 3);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'curriculum_documents_grade_level_check'
  ) then
    alter table public.curriculum_documents
      add constraint curriculum_documents_grade_level_check
      check (grade_level is null or grade_level between 1 and 12);
  end if;
end
$$;

-- Retrieval joins documents to sources and filters on (subject, grade, topic,
-- term). Without this index the query is a sequential scan of every document on
-- every generation request.
create index if not exists idx_curriculum_documents_lookup
  on public.curriculum_documents (grade_level, term, lesson_topic);

create index if not exists idx_curriculum_documents_source
  on public.curriculum_documents (source_id);

-- ---------------------------------------------------------------------------
-- 4. pedagogical_activities — a bank of runnable classroom activities
--
-- Separate from `curriculum_chunks` because these are structured, they are
-- reusable across lessons, and a teacher may filter them by activity type. The
-- contract is that only a staff member writes them: a teacher-generated activity
-- reads as a verified classroom practice once it is in this table, and that is a
-- claim only a reviewer can make.
-- ---------------------------------------------------------------------------
create table if not exists public.pedagogical_activities (
  id uuid default gen_random_uuid() not null,
  subject text not null,
  topic text,
  activity_name text not null,
  activity_type text not null,
  description text not null,
  materials_needed text,
  grade_level smallint,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.pedagogical_activities is
  'Reusable classroom activities, written by staff. Deliberately has no verified_at column: unlike curriculum text, an activity makes no claim about an external source, so there is nothing for a source check to confirm. The staff-only write policy is the whole trust boundary.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedagogical_activities_pkey'
  ) then
    alter table public.pedagogical_activities
      add constraint pedagogical_activities_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pedagogical_activities_created_by_fkey'
  ) then
    alter table public.pedagogical_activities
      add constraint pedagogical_activities_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pedagogical_activities_grade_level_check'
  ) then
    alter table public.pedagogical_activities
      add constraint pedagogical_activities_grade_level_check
      check (grade_level is null or grade_level between 1 and 12);
  end if;
end
$$;

create index if not exists idx_pedagogical_activities_lookup
  on public.pedagogical_activities (subject, grade_level, topic);

-- The same updated_at trigger the other tables use — `tg_set_updated_at` is in
-- the baseline and is already applied to curriculum_sources.
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_pedagogical_activities_updated_at'
       and tgrelid = 'public.pedagogical_activities'::regclass
  ) then
    create trigger trg_pedagogical_activities_updated_at
      before update on public.pedagogical_activities
      for each row execute function public.tg_set_updated_at();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS on the new table
-- ---------------------------------------------------------------------------
alter table public.pedagogical_activities enable row level security;
alter table public.pedagogical_activities force row level security;

-- ---------------------------------------------------------------------------
-- 6. Policies for review reads and staff writes
--
-- Only pedagogical_activities gets new policies here. The curriculum tables'
-- existing staff-write policies (curriculum_docs_write_staff,
-- curriculum_docs_update_staff, curriculum_sources_write_staff,
-- curriculum_sources_update_staff, curriculum_chunks_write_staff) are left
-- exactly as the baseline defines them: they already check is_staff and there is
-- no defect in them. The SELECT policies are replaced in section 8, because
-- `using (true)` is the defect.
-- ---------------------------------------------------------------------------
drop policy if exists pedagogical_activities_select_auth on public.pedagogical_activities;
create policy pedagogical_activities_select_auth on public.pedagogical_activities
  for select to authenticated using (true);

drop policy if exists pedagogical_activities_write_staff on public.pedagogical_activities;
create policy pedagogical_activities_write_staff on public.pedagogical_activities
  for insert to authenticated with check (public.is_staff(auth.uid()));

drop policy if exists pedagogical_activities_update_staff on public.pedagogical_activities;
create policy pedagogical_activities_update_staff on public.pedagogical_activities
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists pedagogical_activities_delete_staff on public.pedagogical_activities;
create policy pedagogical_activities_delete_staff on public.pedagogical_activities
  for delete to authenticated using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. A verified-only SELECT policy for the three curriculum tables
--
-- The name states the rule. `curriculum_sources_select_auth` was accurate as a
-- name and wrong as a policy, and a later reader has no way to tell the two
-- apart without opening it.
--
-- The filter is on the parent's verified_at for documents and chunks, because
-- verification is a property of the source, not of one page of it. A document
-- cannot be more verified than the book it came from.
--
-- FORCE ROW LEVEL SECURITY is set on all three tables by the baseline, so this
-- applies to the table owner as well. The service-role client used by the
-- verification script bypasses RLS by role, not by ownership, which is the
-- intended split: an unverified row is unreachable from a teacher session and
-- reachable only from a privileged one.
-- ---------------------------------------------------------------------------
drop policy if exists curriculum_sources_select_verified on public.curriculum_sources;
create policy curriculum_sources_select_verified on public.curriculum_sources
  for select to authenticated using (verified_at is not null);

drop policy if exists curriculum_documents_select_verified on public.curriculum_documents;
create policy curriculum_documents_select_verified on public.curriculum_documents
  for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_sources s
       where s.id = curriculum_documents.source_id
         and s.verified_at is not null
    )
  );

drop policy if exists curriculum_chunks_select_verified on public.curriculum_chunks;
create policy curriculum_chunks_select_verified on public.curriculum_chunks
  for select to authenticated
  using (
    exists (
      select 1
        from public.curriculum_documents d
        join public.curriculum_sources s on s.id = d.source_id
       where d.id = curriculum_chunks.document_id
         and s.verified_at is not null
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Drop the policies the new ones replace
--
-- These are the `using (true)` SELECT policies. Dropping them is the change that
-- makes an unverified row invisible; leaving them in place would OR with the new
-- policy (policies are permissive by default) and widen access back to
-- everything.
--
-- `curriculum_docs_select_auth` is deliberately NOT recreated: the replacement
-- above carries the same name shape with the correct rule.
-- ---------------------------------------------------------------------------
drop policy if exists curriculum_sources_select_auth on public.curriculum_sources;
drop policy if exists curriculum_docs_select_auth on public.curriculum_documents;
drop policy if exists curriculum_chunks_select_auth on public.curriculum_chunks;

-- ---------------------------------------------------------------------------
-- 9. Close the grant surface on the curriculum tables
--
-- ORDER MATTERS. `revoke all on table` removes table-level entries and leaves
-- every `pg_attribute.attacl` entry untouched; the column-level revokes below
-- are the only thing that removes those, and they are issued for the exact
-- column set `expected-grants.txt` records.
--
-- anon loses everything, including SELECT. There is no anonymous path into
-- curriculum text: it is read by a signed-in teacher through the verified-only
-- policy, and by the service role in the verification script.
-- ---------------------------------------------------------------------------
revoke all on table public.curriculum_sources from anon, authenticated;
revoke all on table public.curriculum_documents from anon, authenticated;
revoke all on table public.curriculum_chunks from anon, authenticated;

revoke all (id, title, publisher, stage, subject, edition, status, verified_by, verified_at, created_at, updated_at, source_kind, base_url)
  on public.curriculum_sources from anon, authenticated;
revoke all (id, source_id, title, unit, page_from, page_to, created_at, lesson_topic, learning_outcomes_text, term, grade_level, unit_number)
  on public.curriculum_documents from anon, authenticated;
revoke all (id, document_id, chunk_index, content, token_count, created_at)
  on public.curriculum_chunks from anon, authenticated;

-- What the application actually needs in a teacher session: read the verified
-- rows. Every write path in the product goes through the service role, so no
-- teacher session holds INSERT, UPDATE, DELETE, TRUNCATE or MAINTAIN here — the
-- staff policies above remain as the second layer for a staff member acting
-- through PostgREST with a session token, which is how the review UI will work.
grant select on public.curriculum_sources to authenticated;
grant select on public.curriculum_documents to authenticated;
grant select on public.curriculum_chunks to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Grants on pedagogical_activities
--
-- Same shape as the student tables: nothing to anon, SELECT plus staff-gated
-- writes to authenticated, everything to the service role.
-- ---------------------------------------------------------------------------
revoke all on table public.pedagogical_activities from anon, authenticated;

grant select, insert, update, delete on public.pedagogical_activities to authenticated;

-- ---------------------------------------------------------------------------
-- 11. search_curriculum_text() — lesson-specific retrieval
--
-- Defined as a function for one reason beyond convenience: the retrieval ORDER
-- is the honesty mechanism, and it should be readable in one place rather than
-- reconstructed from a PostgREST query string in a TypeScript file.
--
--   1. exact:    the specific lesson, in the requested term
--   2. broad:    a document scoped to the unit or subject (lesson_topic is null)
--   3. nothing:  no rows, and the caller must NOT substitute a portal link
--
-- Case 3 is not a failure state to be papered over. A lesson plan written with
-- no curriculum text is a perfectly good lesson plan as long as it says so, and
-- the caller is responsible for saying so.
--
-- `term` is matched as `d.term is null or d.term = p_term`: a document that is
-- not term-specific applies to every term, while a term-specific document for the
-- wrong term is excluded. A strict `=` would make every non-term document
-- unreachable.
--
-- SECURITY DEFINER because it reads through the verified-only policies on behalf
-- of the caller and must not be blocked by them; it re-applies the same
-- verified_at filter itself, so defining it this way does not widen what a caller
-- can see. `search_path` is pinned empty and every reference is schema-qualified,
-- so a caller cannot shadow `curriculum_sources` with their own object.
--
-- Returns learning_outcomes_text or, when a document has no outcome text, the
-- concatenated chunk content. A document with neither is not returned: an empty
-- result is more useful to the caller than a row that says nothing.
-- ---------------------------------------------------------------------------
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
security definer
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

comment on function public.search_curriculum_text(text, smallint, text, smallint, integer) is
  'Lesson-specific retrieval over verified OFFICIAL curriculum text. Returns nothing when nothing matches — the caller must then tell the user the output is based on general Bahraini curriculum standards, and must NOT substitute a portal link for lesson content.';

-- EXECUTE is granted to authenticated only. `anon` is revoked explicitly and
-- listed nowhere in anon-execute-allowlist.txt, so the CI guard would fail if a
-- future grant leaked it back.
revoke all on function public.search_curriculum_text(text, smallint, text, smallint, integer) from public, anon;
grant execute on function public.search_curriculum_text(text, smallint, text, smallint, integer) to authenticated;
