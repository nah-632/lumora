## SERVO — Core Platform (Phase 2–5 foundation)

Premium bilingual home-services platform for Bahrain. This PR lands the
domain, booking engine, admin operations and Arabic-first UI foundation.

### What's verified (evidence-based)
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| Domain tests (`node --test`) | ✅ 3 suites / 25 assertions, 0 fail |
| Booking lifecycle vs live Postgres 16 | ✅ draft→completed + audit + history |
| `next/server` route unit tests | ⛔ skipped by decision (anti-pattern outside Next runtime; covered by E2E later) |

### Layers
- **domain/** — pure, zero deps: booking state machine (explicit transition
  table, actor-scoped), money (integer fils, VAT off by default), bahrain
  (+973 normalization, governorates, Asia/Bahrain).
- **data-access/** — pg Pool, fail-fast on missing env.
- **services/** — createBooking (idempotent), transitionBooking
  (server-enforced + history + audit), trackBooking (ref + last-4 gate).
- **app/api/** — thin Zod-validated wrappers over the service layer.
- **components/ + app/** — AR-first RTL UI on brand design tokens.

### Security properties
- RLS enabled on every business table; `audit_logs` append-only (no
  UPDATE/DELETE policies).
- Public tracking requires reference **plus** phone last-4; never returns
  name or address.
- All state transitions enforced server-side with role scoping.
- Secrets: `.env.example` only; `.env.local` gitignored.

### Honesty constraints honored
- No fabricated reviews, ratings, customer counts, or app-store links.
- Trust claims render only when admin-verified (currently hidden).
- Prices show "request a quote" unless a pricing rule exists.

### Known limitations (not claimed as done)
- Production build not yet run in this sandbox (memory-constrained); deferred
  to end-of-project with a larger heap.
- Browser E2E not run — API routes to be covered by Playwright.
- Logo is a temporary wordmark; original vector still required (launch blocker).
- Photography is placeholder art direction, not final assets.

### Next
Provider portal, content management (AR/EN versioning), notifications,
WhatsApp integration behind a provider interface, payments flag-gated.
