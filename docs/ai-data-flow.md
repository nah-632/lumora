# AI teacher tools — data flow

What leaves the device when a teacher uses one of the AI tools, what is kept, and
what is deliberately not. Written to be checkable against the code rather than
read as reassurance: every claim below names the file that implements it.

Last reviewed: 2026-10-28 (branch `feat/ai-teacher-tools`).

---

## 1. The short version

| | |
|---|---|
| **Sent to the provider** | The teacher's option choices, plus the free text they typed in `topic`, `notes` or `studentName` — where the last of these is dropped before sending. |
| **Not sent** | Any student record, grade, submission, roster entry, alert, session token, teacher identity, or file from the database. |
| **Stored by us** | Nothing. There is no AI table, no generation log, no cache. |
| **Logged** | Status code, latency, tool id, error code, attempt count. Never input, prompt or output. |
| **Provider retention** | Governed by the provider's own terms. **Not verified — see open item 1.** |

The feature has no database access at all. Every write in this codebase goes
through RLS with the teacher's own token; this route never touches a table.

---

## 2. Request path

```
Browser
  │  POST /api/generate/{toolId}
  │  body: { options: { ... } }        ← nothing else is accepted
  ▼
src/app/api/generate/[toolId]/route.ts
  │  1. session check                  → 401 for anonymous
  │  2. provider key check             → 503 when unconfigured
  │  3. envelope + options validation  → 400 on anything unknown
  │  4. rate limit (5/min, 60/day)     → 429
  ▼
src/lib/ai/generate.ts
  │  buildPrompt() — assembles system + user message from the registry template
  ▼
Provider (OpenAI-compatible; HF router by default)
  │
  ▼  raw text
  schema validation → cross-field checks → language check
  │  on failure: at most one retry (see §5)
  ▼
Browser: { ok: true, data: {...} }
```

### The envelope is strict by construction

The route accepts exactly `{ options: {...} }`. `parseRequestEnvelope()` applies a
`.strict()` schema, so a body carrying `prompt`, `system`, `model` or any other key
is rejected with a 400 rather than having the extra key ignored. **The client
cannot supply any part of the prompt.** The system prompt comes from
`src/lib/ai/tools.ts` and nothing else can reach it.

---

## 3. Exact fields per tool

Field names below are the wire names the browser sends and the route validates.

### `lesson-plan`

| Field | Type | Sent to provider |
|---|---|---|
| `outputLanguage` | `"ar" \| "en"` | Yes — selects the prompt variant and is echoed as `output_language` |
| `grade` | `"7" \| "8" \| "9"` | Yes |
| `subject` | enum (7 subjects) | Yes |
| `duration` | `"30" \| "45" \| "60"` | Yes |
| `teachingStyles` | array of enum (1–5) | Yes |
| `topic` | string, ≤120, optional | Yes — fenced |

### `questions`

| Field | Type | Sent to provider |
|---|---|---|
| `outputLanguage` | `"ar" \| "en"` | Yes |
| `grade` | `"7" \| "8" \| "9"` | Yes |
| `subject` | enum | Yes |
| `questionTypes` | array of `mcq`/`true-false`/`short` | Yes |
| `count` | `"5" \| "10" \| "15"` | Yes |
| `difficulty` | `easy`/`medium`/`hard`/`mixed` | Yes |
| `topic` | string, ≤120, optional | Yes — fenced |

### `remedial-plan`

| Field | Type | Sent to provider |
|---|---|---|
| `outputLanguage` | `"ar" \| "en"` | Yes |
| `grade` | `"7" \| "8" \| "9"` | Yes |
| `subject` | enum | Yes |
| `score` | integer 0–100 | Yes |
| `difficultyTags` | array of enum (1–6) | Yes |
| `studentName` | string, ≤50, optional | **No — dropped before sending** |
| `notes` | string, ≤500, optional | Yes — fenced |

**`studentName` is accepted but not transmitted.** It exists so the teacher can
label their own printout. `buildPrompt()` in `src/lib/ai/generate.ts` removes the
line entirely rather than rendering an empty block, and a test asserts the name
does not appear anywhere in the outgoing message. This is the one piece of
personal data in the whole feature, and the plan does not need it: the model is
given a score and difficulty tags, which is what the pedagogical advice rests on.

### Sanitisation applied to every free-text field

Before validation, `stripControlChars()` removes C0/C1 controls, DEL, the Unicode
bidi overrides (U+202A–202E, U+2066–2069) and the zero-width characters
(U+200B–200F, U+FEFF). Tab and newline survive, because pasting a topic list is a
legitimate thing for a teacher to do.

Free text is then fenced as `<topic>…</topic>` or `<notes>…</notes>`, with the
interior indented by two spaces. The indentation is what makes the fence real: a
value containing newlines would otherwise leave anything after a forged closing
tag on its own line, outside the block, where it reads as a top-level instruction
to the model. Forged tags are also replaced with `[redacted]`.

---

## 4. What is never sent

No field from any database table is included in a request. Concretely, the
provider never receives:

- a student's name, id, class or grade record, **except** a name the teacher
  typed into the optional `studentName` field — and that is dropped before sending
- grades, submission statuses, attendance, or alert text from `student_alerts`
- the teacher's email, user id, role, or session token
- anything about the school, the roster, or another teacher
- file contents, uploads, or images — the tools accept no file input

The two features are unconnected: `generate-alerts.ts` sends aggregated signals
with opaque refs (`s1`, `s2`) and never a name, and it is a separate module with
its own prompt. Nothing in this feature imports it.

---

## 5. Retries and what a second call contains

At most **two** provider calls per request.

| Trigger | Second call contains |
|---|---|
| Truncated response, `questions` tool, count > 5 | The same options with `count` reduced by 5, and a smaller token budget. No prior output. |
| Invalid JSON or a structural failure | The original request plus a **sanitised** summary: zod paths and expected-vs-received shapes only, e.g. `"stages": expected at least 2 items, received fewer`. |
| Language mismatch | The original request plus a target-language instruction and the measured ratio. |

The repair summary never quotes a value. `summariseIssues()` reads only `path`,
`code` and counts or type names; `issue.message` is excluded because zod embeds
values in some of its messages, and the enum message would echo the model's own
output back at it. So a student name or a generated paragraph cannot be
re-transmitted through a repair prompt. Tests assert this for hostile input and
for a name in a generated payload.

---

## 6. What is stored and logged

**Stored: nothing.** The feature adds no table, no migration and no cache. The
generated draft exists only in the browser's React state until the teacher copies,
prints or navigates away. Reloading the page loses it, which is the honest
behaviour for something described as a draft.

**Logged** — `src/lib/ai/limit.ts`, `serverLogger()`:

```json
{"scope":"ai.generate","code":"ok","toolId":"lesson-plan","status":200,"latencyMs":1840,"attempts":1}
```

The signature accepts only scalars, which is the enforcement mechanism: there is
no field a prompt, an option or a generated body could be passed through. A
provider `Error` is never logged either, because its message can embed the request
body. Codes are a closed set: `ok`, `repair_retry`, `truncated_retry`,
`language_retry`, `invalid_input`, `ai_not_configured`, `rate_limited`,
`quota_exceeded`, `ai_output_invalid`, `failed`.

No correlation id is emitted, because nothing is persisted to correlate against —
a per-request id would be written and then discarded. If a generation log is ever
added, `requestId` and `entryPoint` become mandatory at that point.

Tests capture every line the logger produces and assert that a student name, a
sent topic, and generated text never appear in one, and that no unexpected field
is ever present.

---

## 7. Provider refusals, and the HTTP 200 hazard

The router reports several refusals as an error body on a **successful** status,
which the `@ai-sdk/openai` client flattens to the opaque `Invalid JSON response`.
That message points at the prompt when the real cause is the account.

`src/lib/ai/provider-errors.ts` classifies every response **body** before the
status is trusted, and the route issues its own guarded request rather than going
through `generateText` — inspecting the body is only possible if we make the call.

| Code | Meaning | Route mapping |
|---|---|---|
| `provider_credits_exhausted` | the account has no balance | 503 `provider_unavailable` |
| `provider_model_not_supported` | no enabled provider serves that model | 503 `provider_unavailable` |
| `provider_unauthorized` | key missing or rejected | 503 `ai_not_configured` |
| `provider_rate_limited` | provider-side throttle | 429 `rate_limited` |
| `provider_bad_response` | an identified failure, or a body that is not a completion | 503 `provider_unavailable` |

The provider's own wording is **never** forwarded to the client and never logged —
only a code from a fixed union. A body with no `choices` array is not treated as a
completion regardless of the status code. Tests cover the real observed bodies,
hostile inputs that must not throw, and the no-leak guarantee.

## 8. Bilingual behaviour

`outputLanguage` is a field of the request, not a property of the interface. The
prompt variant follows it; so does the `dir` and `lang` of the result container.

The language of the draft is checked server-side (`src/lib/ai/language.ts`) and a
mismatch triggers one repair. The check is **content-based and three-valued**: a
numbers-heavy answer or a short term list returns `undecidable` and passes through,
because a false mismatch costs a second billed call and rewrites a usable result.
Over 80% of letters in either script decides immediately; the middle band is
decided by function words.

---

## 8. Retention and data-subject requests

Because nothing is stored, there is nothing to export or delete on our side. A
teacher's own printed or copied output is a file they control.

**This does not cover the provider.** The prompt and response are received by the
provider, whose retention, training-use and sub-processor terms apply. See open
item 1.

---

## 9. Open items

These are unresolved. They need a decision from the owner and, in two cases, a
qualified legal opinion. They are listed here rather than in a ticket so they
travel with the code.

1. **Provider data policy is unverified.** The default endpoint is the Hugging
   Face router with `tiiuae/Falcon-H1-3B-Instruct`. Which provider ultimately
   serves a request, whether prompts are retained, and whether they may be used
   for training have **not** been established. For a product used by teachers in
   Bahrain handling notes about minors, this must be settled before the feature is
   enabled for real users. A self-hosted or contractually-bound provider avoids
   the question entirely and is the safer default.

2. **Consent for the remedial tool.** The notice and the "I understand" checkbox
   are a client-side affordance, not a security control: they gate the first
   submission in the UI and are not enforced server-side, because the server has
   nothing to gate — it sends no name. Whether a teacher's acknowledgement is
   sufficient authority to send a child's difficulty notes to a third party, or
   whether guardian consent is required, is a legal question this document does
   not answer. Bahrain's PDPL and any education-specific rules apply. **Verify
   with a qualified source; do not infer from this file.**

3. **Ages and minors.** `studentName` is optional and dropped, and no student
   identifiers are sent. But a teacher can type anything into `notes`, including a
   name or identifying detail. A prompt-level instruction cannot prevent that, and
   a client-side filter would give false confidence. The realistic mitigations are
   the hint text (already present, in both languages) and — if it proves to be a
   problem — a content check before sending.

4. **Rate limiting is per-process.** 5 requests/minute and 60/day per user, held
   in memory. On a single Node instance this is exact; on serverless each instance
   keeps its own counters, so the effective limit is (limit × live instances) and
   a cold start resets them. A shared store keyed by user id is the fix, and the
   `RateLimiter` interface does not change when it happens.

5. **Content quality has not been evaluated.** The checks here are structural and
   linguistic: is it valid JSON, is a multiple-choice question answerable, is it
   in the right language. **Nothing verifies that a lesson plan is pedagogically
   sound, accurate to the Bahraini curriculum, or appropriate for the grade.** A
   human teacher must review samples of each tool before this is offered as
   finished work. `scripts/eval-ai.mjs` collects those samples; it does not judge
   them.

   **It has not yet collected any.** Verified on 2026-10-28 against the configured
   account:

   ```
   GET /api/whoami-v2  →  {"name":"Lumora-6666","canPay":false,
                           "billingMode":"prepaid","isPro":false}
   ```

   The account is on **prepaid billing with a zero balance and no PRO
   subscription**, and every model the router will serve this token is a billed
   provider:

   - `GET /v1/models` lists 137 models, **none** with `is_free: true`.
   - The two models commonly suggested as free (`meta-llama/Llama-3.2-3B-Instruct`,
     `Qwen/Qwen2.5-7B-Instruct`) return `model_not_supported` — they are not routed
     to any provider this account has enabled, so they are not a workaround.
   - A routable model (`Qwen/Qwen3.5-9B`) returns the 402 refusal.
   - `api-inference.huggingface.co`, the retired free serverless endpoint, no
     longer resolves at all.

   So there is **no free path on this token**, and no generation has succeeded end
   to end. The only evidence that the pipeline works is the test suite: 198 unit
   and integration tests exercising every branch with an injected generator. That
   is real coverage of the logic and no evidence at all about output quality. Both
   facts belong here.

   **Unblocking it needs one of:** (a) credits on this account, (b) a PRO
   subscription, (c) a key for another OpenAI-compatible endpoint (OpenRouter and
   its `:free` tier would work — `AI_BASE_URL=https://openrouter.ai/api/v1` plus
   `OPENROUTER_API_KEY`, which the gateway accepts as `AI_API_KEY`), or (d) a
   self-hosted model behind an OpenAI-compatible URL. The gateway is already fully
   env-driven, so any of these is a configuration change and no code change.

6. **The default model is not served by the configured account.** `AI_MODEL`
   defaults to `tiiuae/Falcon-H1-3B-Instruct`, which returns
   `model_not_supported` on this account's enabled providers. The gateway falls
   back to that default when `AI_MODEL` is unset, so an unset variable is a broken
   deployment rather than a safe one. The model list at
   `GET /v1/models` returns 137 models with a live provider, 88 of them advertising
   structured output — a working default should be chosen from that list and
   recorded here. This is worth deciding together with item 5.

7. **No generation log.** Deliberate, and it means there is no record of how often
   a tool produces unusable output in the field. If quality work begins, a log of
   `code`/`toolId`/`attempts` — no content — would make the failure rate visible.
