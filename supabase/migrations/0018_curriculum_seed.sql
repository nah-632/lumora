-- 0018_curriculum_seed.sql — the sources, and the honest state of each one.
--
-- WHAT IS SEEDED, AND WHY SO LITTLE
--
-- Four rows, of which ONE is verified. That is not an unfinished seed; it is the
-- accurate state of what this project knows. The previous version of this task
-- was going to insert a Grade 8 Mathematics teacher-guide PDF URL. It was not
-- inserted, because nobody had confirmed the path, and a guessed URL in a
-- `curriculum_sources` row is exactly the artefact this feature exists to avoid:
-- a link a teacher can tap that leads somewhere unrelated to the citation.
--
-- The measured facts behind each row, checked by fetching it:
--
--   edunet.bh       200, text/html, redirects to https://www.edunet.bh/
--                   title «البوابة التعليمية», footer «حقوق محفوظة © وزارة التربية والتعليم.»
--                   → a Ministry of Education property. VERIFIED, source_kind official.
--
--   moe.gov.bh/ar/moe-educational-resources
--                   200, text/html, no redirect
--                   title «الموارد التعليمية | وزارة التربية والتعليم»
--                   → the Ministry's own domain, so almost certainly official — but
--                   "almost certainly" is the phrase that gets a row marked
--                   official and this file refuses to do it. Nothing in the page
--                   or the domain has been checked against a second source that
--                   says this path is the canonical one for resources. It is
--                   seeded as a candidate and one command verifies it.
--
--   almanahj.com/bh     200, commercial aggregator. NOT the Ministry. Explicitly
--                       supplementary_unverified, and it will stay that way: a
--                       third-party site does not become official by resolving.
--
--   bahrain-edu.com     200, redirects to www.bahrain-edu.com. Operator unknown.
--                       supplementary_unverified.
--
-- WHY verified_at IS SET FOR EDUNET AND THE ROW STILL PRODUCES NO LESSON CONTENT
--
-- `verified_at` makes a row VISIBLE. It does not make it RETRIEVABLE. The
-- retrieval function additionally requires `source_kind = 'official'` on the
-- source, and a matching `curriculum_documents` row — and this file seeds no
-- documents, because no learning_outcomes_text has been pasted by anyone who
-- read a source. So the current behaviour is exactly right and exactly honest:
-- a teacher sees one verified portal in the source list, and every generated
-- plan says "Based on general Bahraini curriculum standards".
--
-- `verified_by` is left NULL with a TODO rather than being filled with a
-- plausible-looking uuid. The column is a foreign key to auth.users, so it can
-- only hold a real account, and inventing one would be a false attribution of
-- exactly the kind the column exists to prevent. A row with verified_at set and
-- verified_by NULL means "the URL check passed; no individual has signed off on
-- the content" — which is true here.
--
-- Re-runnable: matched on base_url, so re-applying changes nothing.

-- ---------------------------------------------------------------------------
-- 1. The one verified source
-- ---------------------------------------------------------------------------
insert into public.curriculum_sources (
  title, publisher, stage, subject, edition, status, source_kind, base_url, verified_at, verified_by
)
select
  'البوابة التعليمية — وزارة التربية والتعليم',
  'وزارة التربية والتعليم — مملكة البحرين',
  null,
  null,
  null,
  'approved',
  'official',
  'https://www.edunet.bh',
  now(),
  null  -- TODO: set to the reviewing staff member's auth.users id when one signs off.
from (select 1) as _
where not exists (
  select 1 from public.curriculum_sources where base_url = 'https://www.edunet.bh'
);

comment on table public.curriculum_sources is
  'Curriculum sources. verified_at IS NOT NULL makes a row visible to teachers; retrieval additionally requires source_kind = official and a curriculum_documents row carrying learning_outcomes_text.';

-- ---------------------------------------------------------------------------
-- 2-4. Candidates — invisible to every non-staff reader until verified
-- ---------------------------------------------------------------------------
insert into public.curriculum_sources (
  title, publisher, stage, subject, edition, status, source_kind, base_url, verified_at, verified_by
)
select
  v.title, v.publisher, null, null, null, 'draft', 'supplementary_unverified', v.base_url, null, null
from (
  values
    (
      'الموارد التعليمية — وزارة التربية والتعليم',
      'وزارة التربية والتعليم — مملكة البحرين',
      'https://moe.gov.bh/ar/moe-educational-resources'
    ),
    (
      'المناهج البحرينية — موقع تجميعي (غير رسمي)',
      'almanahj.com',
      'https://almanahj.com/bh'
    ),
    (
      'bahrain-edu — مشغل غير معلوم (غير رسمي)',
      null,
      'https://bahrain-edu.com'
    )
) as v(title, publisher, base_url)
where not exists (
  select 1 from public.curriculum_sources where base_url = v.base_url
);

-- ---------------------------------------------------------------------------
-- 5. The Grade 8 Mathematics teacher guide: a note, not a URL
--
-- The original task asked for this row with the real PDF path. The path was
-- never confirmed, and a `base_url` is what the references block renders to a
-- teacher, so it is the one field that must not be a guess. The row is seeded
-- with base_url NULL, which means:
--
--   * `scripts/verify-curriculum-links.mjs` skips it (it selects where base_url
--     is not null), so it cannot be verified by accident;
--   * the verified-only policy hides it, because verified_at is null;
--   * the intended location is recorded where a human will find it.
--
-- Filling in base_url is a two-minute job for someone who has the guide open in
-- a browser, and it is the only way this row becomes real.
-- ---------------------------------------------------------------------------
insert into public.curriculum_sources (
  title, publisher, stage, subject, edition, status, source_kind, base_url, verified_at, verified_by
)
select
  'دليل المعلم — الرياضيات، الصف الثامن (المسار غير مؤكد)',
  'وزارة التربية والتعليم — مملكة البحرين',
  'intermediate',
  'math',
  null,
  'draft',
  'supplementary_unverified',
  null,
  null,
  null
from (select 1) as _
where not exists (
  select 1 from public.curriculum_sources
   where title = 'دليل المعلم — الرياضيات، الصف الثامن (المسار غير مؤكد)'
);

comment on column public.curriculum_sources.base_url is
  'The source landing page. The ONLY url the application shows a teacher, read from this column and never from model output. NULL means the exact path is unconfirmed — leave it NULL rather than guessing: this value is rendered as a citation.';
