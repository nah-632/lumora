# LUMORA — Product Context

## What it is
A smart assistant for teachers in Bahrain government schools. It begins with the
full intermediate stage (المرحلة الإعدادية) and is designed to expand to other
stages and subjects. Tagline: «مساعدك الذكي لإلهام الغد». Slogan: «نرتقي بالمعلم ، لنرتقي بالوطن».

## Who uses it
Teachers. One private account per teacher, with strict per-account data
isolation. Secondary roles exist for curriculum review (reviewer) and platform
administration (admin), neither of which has standing access to a teacher's
private content.

## Product truths that constrain design
- LUMORA is an independent initiative and is NOT endorsed by the Ministry of Education. This must be stated plainly, never implied otherwise.
- The teacher is always the decision-maker. LUMORA suggests; it never decides and never acts on a student automatically.
- Privacy first. Student records are owned by one teacher, students are minors, and no student-facing access exists.
- Nothing external is ever sent automatically. Messages are drafted for the teacher to review and copy.
- Never present canned text as generated output. When no AI provider is configured, show a clear setup state.

## Scope of this surface
Teacher-facing student progress tracking: a roster, per-student grade and
submission records, deterministic signal detection, AI-interpreted alerts, and
class-level insight on the dashboard.

## Hard non-goals
- No risk scores, no student rankings, no predictive judgements about a student.
- No comparison of one student against another.
- No diagnosing of causes; the data is described, never explained away.
- No student names in page titles, URLs, analytics or logs.

## Language
Arabic (RTL) is the default; English (LTR) is fully supported. Both are written
natively, never machine-translated from the other. Teachers choose content
language independently of UI language.

## Voice
Short, specific, human, in the vocabulary Bahraini teachers actually use. No
marketing exaggeration, no buzzwords.
