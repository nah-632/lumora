# LUMORA — Home Services Platform

Premium, trustworthy home-services platform for the Kingdom of Bahrain.
Arabic-first (RTL) with complete English support.

> **Your Home. Our Priority.**
> «خدمات منزلية متكاملة بجودة وموثوقية»

---

## Status — honest summary

| Area | State |
|---|---|
| Domain layer (state machine, money, phone) | ✅ Tested — 3 suites, 25 assertions, 0 fail |
| Database schema (27 tables, RLS, append-only audit) | ✅ Applied & verified on Postgres 16 |
| Booking engine (create / transition / track) | ✅ Verified against live DB |
| Admin API + dashboard | ✅ Implemented, DB-verified |
| Homepage / booking flow / tracking UI | ⚠️ Implemented — **not yet verified in a browser** |
| Production build | ⛔ Not run (memory-constrained sandbox) |
| Payments / WhatsApp / Reviews | ⛔ Not implemented — flag-gated, OFF |

Nothing above is claimed as working without evidence. Items marked ⚠️/⛔
have not been proven and must be verified before launch.

---

## Quick start

```bash
cp .env.example .env.local
./scripts/db-start.sh          # idempotent Postgres 16 startup (pgshim)
node --test tests/domain/*.test.mjs    # pure domain tests, no DB needed
npm run dev                    # dev server (see caveat below)
```

### Postgres in this environment

Runs on PG 16 with a shim (`/opt/pgshim/libshm.so`) because the Android
kernel has no SysV IPC. `scripts/db-start.sh` handles the full ritual:
stale-lock cleanup → shm segment cleanup → socket dir → start → create DB.

---

## Architecture

```
src/
  app/            Next.js App Router — pages + API routes (thin wrappers)
  components/     UI primitives on design tokens
  domain/         Pure business rules — no I/O, no framework (*.mjs)
  data-access/    Postgres pool, fail-fast env validation
  services/       Application services — the only place business rules meet the DB
  design/         Design tokens (single source of truth)
db/migrations/    Versioned SQL: schema + reference seed
tests/            node:test suites (no test framework installed)
```

**Rule enforced throughout:** business rules live in `domain/` and are
enforced server-side in `services/`. The UI never decides anything.

### Booking state machine

```
draft → pending_confirmation → confirmed → assigned
     → technician_en_route → in_progress → completed
side exits: cancelled (within policy window), rejected
```

Every transition declares which actor roles may perform it. Illegal
transitions throw `IllegalTransitionError`. Each one writes both
`booking_status_history` and `audit_logs`.

### Booking references

`LMR-` + 8 random base32 chars — non-sequential, so references cannot
be enumerated. Public tracking needs the reference **plus** the phone's
last 4 digits, and returns status and service type only — never the
customer name, phone, or address.

---

## Security properties (implemented)

- RLS enabled on every business table (11 tables + audit policies).
- `audit_logs` is append-only: `UPDATE` and `DELETE` are denied by policy.
- All transitions enforced server-side with role scoping — hiding a
  button in the UI is never treated as security.
- Zod validation on every API input; Bahrain phone normalized to E.164.
- Idempotent booking creation on a client-supplied key (no duplicates
  from double-taps or retries).
- Secrets stay server-side; `.env.local` is gitignored.

## Honesty constraints (from the product spec)

- No fabricated reviews, ratings, customer counts, certifications,
  warranties, prices, phone numbers, or app-store links.
- Trust claims render only when an admin marks them verified — the
  strip is hidden when empty (it is empty today).
- Services without a pricing rule show «طلب عرض سعر» — never an invented price.
- Unfinished integrations get an interface boundary and honest docs,
  never a simulated success.

## Environment variables

See `.env.example`. Required: `PGDATABASE`. Feature flags
(`FEATURE_PAYMENTS`, `FEATURE_WHATSAPP`, `FEATURE_REVIEWS`) default to
`false`.

## Known blockers before launch

1. **Logo** — the official mark exists only inside a reference image;
   the original vector is required. Current build uses a temporary wordmark.
2. **Photography** — placeholders are art direction only.
3. **Business data** — WhatsApp number, hours, coverage areas, and legal
   policies must come from verified configuration.
4. **Build verification** — production build and browser E2E still to run.

## Tooling note

Tests use Node's built-in `node:test` + `node:assert` — no Vitest, no Jest.
In a memory-constrained environment a test runner's install cost and
runtime outweigh its benefits for a suite this size.
