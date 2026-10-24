# Security

## Student data is personal data about minors — status: BREAKING CHANGE

The original v1 rule "no student personal data" has been **officially overridden**
by the Product Owner. LUMORA now stores student names, grade levels, grades,
submissions and teacher interventions.

### What this changes
- The threat model now includes minors' data, so disclosure has a higher impact
  than a normal account leak.
- Every access path must be justified. There is no convenience exception.

### Controls in place (each verified, not assumed)
| Control | Where | Verified by |
|---|---|---|
| Owner-only RLS on all six student tables | `0010`, `0011` | isolation suite, 16 assertions as the `authenticated` role |
| Cross-teacher links impossible at the constraint level | composite FK `(student_id, teacher_id)` | isolation suite, forge attempts rejected |
| Child rows hidden when the parent is soft-deleted | RLS policies | isolation suite |
| Teachers cannot hard-delete students | no DELETE policy, no DELETE grant | isolation suite (HTTP 403) |
| Alert text immutable to clients | column grants limited to `is_read`, `snoozed_until`, `dismissed_at`, `dismissed_reason` | migration grants |
| No standing admin access | `admin_read_student()` requires role + reason, writes audit | designed in `0010` |
| Names never sent to an AI provider | opaque refs + abort-on-name guard | AI suite, canary-verified |

### Retention
- Soft delete keeps a student restorable for **30 days**.
- A daily job (`purge_expired_students_job`) permanently removes students 30 days
  past deletion; children cascade in the same statement.
- Account deletion cascades immediately via the `auth.users` foreign key.

### Known gaps — stated, not hidden
- **No rate limiting** on the alert-generation endpoint yet.
- **No malware scanning** on any upload path, because no upload path exists yet.
- **Single environment:** development, staging and production are not separated.
  All testing so far ran against one project. This must be fixed before real
  student data is entered.
- **Legal review** of student-data handling under Bahrain PDPL is pending; nothing
  here should be read as a compliance claim.

### Secret handling
- No secret is committed. `.env*` except `.env.example` is ignored.
- The `service_role` key is server-only and is never referenced from a client
  component or a teacher-facing route.
- CI fails loudly when isolation secrets are absent rather than skipping the test.
