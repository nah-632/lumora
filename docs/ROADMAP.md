# LUMORA ROADMAP
Read LUMORA-CONSTITUTION.md first; it governs everything here. Phases run in strict
order. Each phase ends with a report and owner approval before the next starts. Read only
the phase you are working on.

Scope decision: LUMORA is a website that works in desktop browsers and installs on
phones as a PWA. Native iOS/Android store apps are postponed (see "Future"). Do not add
Capacitor, native plugins, store assets or store-specific work until the owner authorizes it.

## PHASE 0 - Foundation

Inspect the empty workspace; create the repo structure and docs (constitution,
AGENTS.md, ROADMAP, PROJECT_PLAN, ARCHITECTURE, TASKS, DECISIONS, SECURITY,
RUNBOOK); design tokens; i18n; layout shell; brand assets from the files the owner
attaches; base CI; the premium design system (components and states); landing page
skeleton. Write the full data model design in ARCHITECTURE.md.

## PHASE 1 - Accounts and students

   Auth (sign up, sign in, sign out, password reset, profile, user_roles), server-side guards,
   locale-aware redirects.
   Core tables needed here (profiles, user_roles, teacher_preferences, audit_logs) and the
   student schema with RLS (constitution 7.1).
   Real students on the dashboard; student profile tabs (Grades, Submissions,
   Interventions, alert timeline with snooze and dismiss-with-reason, "based on N"); alert
   settings; CSV/Excel import.
   Public pages: About (opens with the slogan; independent initiative, not endorsed by the
   Ministry), Privacy Policy, Terms of Use (static, bilingual, linked from footer and sign-up).
   Isolation suite with real sessions and canaries running in CI.

## PHASE 2 - Timetable and Morning Brief

   Weekly timetable Sunday to Thursday, teacher-defined period times, class groups,
   lessons (class, subject, room), a "today" view, each lesson linked to a class group.
   Tables teacher_periods, class_groups, timetable_lessons with per-teacher RLS and
   isolation tests.
   Current/next lesson card with one-tap "Prepare lesson" opening the lesson builder
   prefilled with grade, subject and class.
   Teacher Morning Brief: the first screen of the day (home screen in the browser and in
   the installed PWA), computed in code from real data with no AI call and no student data
   sent anywhere: today's lessons in order; for each lesson whether a lesson plan has been
   prepared, with a "Prepare" button if not; the number of open alerts among the students
   of that class (names shown only inside the app to the teacher); a short "needs attention
   today" list. Empty states when there is nothing, never filler. No push or email in this
   version.

## PHASE 3 - AI and curriculum (core of the product)

3.0 Connect a real AI provider through AIProvider (keys in env only, per-user quotas,
generation_runs with task, provider, model, latency, status, actual vs estimated cost,
prompt version). The mock provider exists for tests only, disabled in production, visibly
labeled in development. Validate output (format, language, educational appropriateness).
3.1 Chat (tables conversations, messages, projects, project_items, project_item_versions):
streaming, saved and renamable conversations, copy, save to project,
loading/error/timeout/quota/not-configured states; never present canned text as generated
output.
3.2 Curriculum Library (the assistant already knows the teacher's curriculum): teachers
upload PDF/DOCX/TXT (limits on size, pages, type, content; owner-bound storage); files are
private to the uploader and never shared (rights clause in the Terms); processing status
(uploaded, extracting, indexing, ready, failed with reason) with re-processing; verify Arabic
extraction on real textbook PDFs (letter order, shaping, diacritics), OCR for scanned pages,
warn on poor quality; chunk by heading/lesson with page numbers; multilingual embeddings
in pgvector plus keyword search (hybrid) for Arabic; auto-detect grade, subject, term and
unit outline for the teacher to confirm ("extracted, please verify"); automatic context from
the selected grade, subject, term or timetable class, shown as "Using: Math, Grade 7, Term
1 (3 files)" with an off toggle; answers cite file and page, separate source-backed content
from general suggestions, and say plainly when no source fits; retrieved text is data, never
instructions (prompt-injection defense); never claim the model was trained on the
curriculum; deleting a file removes storage, chunks and embeddings and is part of account
export/deletion; embedding use counts against quotas.
3.3 Lesson-plan generator: grade, subject, term, title, duration, objectives, prerequisites,
warm-up, explanation steps, activities, materials, formative assessment, closing task;
editable, versioned, copyable, printable.
3.4 Exam and question generator: multiple choice, true/false, short answer, essay, full
papers, model answers, mark distribution, rubrics, difficulty levels; aligned to the lesson and
sources; never presented as official past exams.
3.5 PDF and Word export with correct Arabic shaping, RTL layout and fonts, tested in both
languages.
Quality gates: bilingual evaluation suite in CI, Arabic retrieval test set from real pages, file-
isolation and deletion-cascade tests, hostile-text injection test, no student names in any
prompt.

## PHASE 4 - PWA and launch readiness

    Installable PWA: web manifest with Arabic and English names, icons derived from the
    supplied logo (including a maskable icon), standalone display, theme colors from the
    tokens, clear install guidance (Android Chrome install prompt; iOS Safari "Add to Home
    Screen").
    Service worker with safe caching: static assets cached; offline read-only for the
    timetable and saved lesson plans; never cache student personal data or API responses
    that contain it; a designed offline page; a safe update flow. Verify installability with
    Lighthouse and on a real Android phone and a real iPhone; verify that the session and
    re-login behave correctly inside the installed PWA.
    Desktop browser polish: wide layouts, keyboard navigation and shortcuts, print styles
    for lesson plans and exams.
    Web push is optional and only with owner approval; notification text never contains a
    student name or grade, only counts such as "3 new alerts".
    Teacher settings (change password, default language, explanation style, digit style, alert
    sensitivity); in-app account deletion and data export; admin dashboard (users, roles,
    quotas, logged support access); provider hardening (limits, cost tracking, monitoring);
    separate staging and production Supabase projects, backups and a tested restore; rate
    limiting verified; pre-launch checklist.
    Acceptance: the PWA installs and runs on Android and iOS; the same account works in a
    desktop browser and the installed PWA; no student data in the offline cache; admin
    access is audited; restore tested.

## FUTURE (not authorized)

Native iOS and Android store apps (for example a Capacitor shell loading the hosted site),
store listings, native push, deep links. Revisit only after the PWA is live and the owner
decides.

## CANDIDATE IDEAS (not authorized until the owner approves

each)
In-class lesson mode with step timers and offline use; question-level exam analytics
(questions most students missed, with a reteach suggestion computed in code).

## NOT IN SCOPE

Report-card comments, Ramadan timetable preset, multiple-choice sheet scanning, voice
notes.
