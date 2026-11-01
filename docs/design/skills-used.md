# Skills used on the landing rebuild

Brief: rebuild the LUMORA landing hero and the section beneath it to match the
owner's reference, truthfully. Branch `design/landing-reference`, out of
`feat/ai-teacher-tools` — the branch the Vercel project `lumora-site` deploys
(confirmed from the Vercel deployments API: the live production build is
`62e3e47`, `feat/ai-teacher-tools`).

Each skill below is a document that was read and applied, not an event that
fired. This harness has no session-start injection, so a skill is only ever in
play because it was deliberately loaded.

---

## What each skill contributed

### `lumora-design` — authority
The governing skill, updated by the owner's approvals. It supplied the binding
rules that survived: El Messiri / IBM Plex Sans Arabic / IBM Plex Sans only;
Arabic takes no letter-spacing and no italics; body line-height ≥ 1.6 and the
display headline ≥ 1.15; AA contrast; 44px tap targets; reduced motion; the logo
is never recoloured. Everything in `src/styles/landing-reference.css` that is a
constraint rather than an aesthetic comes from here.

### `design-taste-frontend` — the composition
The physical composition (text column at the physical left, art and cards at the
physical right, the card row overlapping the artwork's lower band) is this
skill's editorial instinct applied to a supplied reference: one clear focal
point, one reading column, and no element that repeats the same gesture.
It also produced the decision to let the **icons** carry the card identity
instead of a badge, and to drop the mockup's decorative icons in the strip in
favour of four that each mean something.

### `impeccable` — the restraint pass
Used as the review that removed things. The mockup's eighth icon, the extra
gradient and the duplicative "most used" ribbon all failed this pass. The rule it
enforced here: if an element is not carrying information or contrast, it is
costing attention.

### `emil-design-eng` — motion
The entrance stagger — header 0, badge .10, headline .20, subtext .30, chips
.40, buttons .50, cards .60 with .08 steps — and the 150–250ms interaction
band. Its contribution to the *implementation* was the decision to express the
stagger as `animation-delay` on a single keyframe rather than as a library,
which is what let this ship with no JavaScript and no new dependency.

### `ui-ux-pro-max` — responsive recomposition
The three layouts below 1280px, and specifically the phone layout: the artwork
becomes a band whose lower edge dissolves into the page surface, the buttons go
full width and stacked, the cards become a 2 × 2 grid and the strip a 2 × 2. Its
contribution was the rule that a mobile layout is **recomposed**, not shrunk —
which is why the phone does not simply scale the desktop frame down.

### `frontend-ui-engineering` — structure and semantics
One `h1`, landmark roles, the whole card as a single link, `aria-hidden` on every
decorative icon, `alt=""` on the background, and the focus order following the
reading direction in both languages.

### `color-expert` — the derivations
The step from the four measured reference points to a usable seven-token set:
how far apart `lavender-100` and `lavender-300` have to be to read as a tint and
a hairline, and why `gold-300`/`gold-500`/`gold-700` is a ramp of three stops
rather than a two-stop gradient. It also produced the two-tone focus ring, after
establishing that no single brand colour passes on both surfaces.

### `performance-optimization` — the LCP path
Priority, `fetchPriority`, `sizes`, the three-crop budget, and the decision to
select crops in `<picture>` rather than in CSS so the browser never fetches a
file it will not use. Also the call to keep the background image out of the
animation entirely: a transform on the LCP element delays the paint it is being
measured for.

### `motion` — the keyframes
The easing curve `cubic-bezier(0.25, 0.1, 0.25, 1)` and the transform/opacity-only
rule, so nothing in the entrance invalidates layout.

### `playwright-cli` — not used, and why
Loaded, then set aside. Playwright drives a real browser; on this device a
Playwright run and a `next build` both hang it. The screenshots came from the
static render harness described below instead. This is a capability that was
**not** available, and it is reported as such rather than worked around
silently.

### `design-review` — the audit pass
The before/after discipline: measure, change one thing, measure again. Every
number in `premium-brief.md` §3 and §4 came out of that loop.

### `verification-before-completion` — the gate
This is what kept three "looks right" claims from shipping:
1. the header rendered **invisible** (it had lost `position: sticky` and
   `z-index` when the Tailwind classes were dropped from the old component);
2. the English headline broke to **four lines** because El Messiri's Latin is
   wider per character than its Arabic, so one `vw` value cannot serve both;
3. at 1024px the text column landed **on the skyline** in Arabic, because
   `margin-inline-start` is the right-hand side in RTL.

None of the three was visible in the source. All three were caught by rendering
and measuring.

---

## Conflicts, and how each was resolved

**1. The reference mockup contradicts the brief in several places.**
The mockup carries a Ministry emblem, a "70%" saving claim, a "most used" crown
and a question bank that does not exist. The brief says the code's truth wins and
lists all of these as forbidden. Resolved in favour of the brief: the claims are
gone, a test now fails if any of them returns, and the differences are listed in
`premium-brief.md` §6.

**2. "Button order follows reading direction" versus the reference's button
positions.**
In Arabic the primary button must be rightmost; the reference has it leftmost,
which is what let the row sit under the card row without touching it. Resolved by
keeping the reading-order requirement and capping the row's physical right edge
at the point where the card row starts. The row ends up 2.3% higher than the
reference, inside the stated tolerance.

**3. "Blur from 768px up" versus the card surface measured in the reference.**
At 76% white with a blur, the artwork moved the card surface out of the range the
reference measures (`#F8E7E2`–`#FBEEEB`). Resolved by keeping the glass at 76%
but making the highlighted card opaque, since it is `purple-800` in the reference
anyway and blurring behind an opaque fill costs paint for nothing.

**4. `prefers-reduced-motion` versus an entrance that starts hidden.**
A stagger expressed as a keyframe with `fill-mode: both` hides its elements
until the animation runs. That is the failure mode the existing `MotionRoot`
exists to prevent. Resolved by keeping the fill mode but anchoring the elements'
base state at the *end* state, so a stylesheet that loads without an advancing
animation clock still leaves a complete page.

**5. The brief said Motion is "already installed".**
It is not: `motion` and `framer-motion` are absent from both `package.json` and
`node_modules`, and the brief also says no new dependencies. Resolved with CSS
keyframes — transform and opacity only, staggered by `animation-delay`. Reported
as a discrepancy rather than worked around.

**6. The brief's "about 6vw" headline versus a 30vw column.**
6vw sets `نرتقي بالمعلم،` at 100px, which is 612px wide and does not fit a 502px
column — it wrapped to four lines. Resolved in favour of the column, which is the
load-bearing requirement: 4.35vw for Arabic, 2.9vw for English, measured so the
longer line fills the column in each script.

---

## Verification harness (not shipped)

`next build` and Playwright both hang this device and `ci.yml` may not change, so
the screenshots come from a throwaway harness under `.lp-preview/`: esbuild
bundles the **real** `SiteHeader` and `LandingHero` with `next/image`,
`next/link` and `next-intl/server` aliased to thin stubs, `react-dom/server`
renders them to static HTML, and the real CSS is compiled by the Tailwind CLI.
The pages are written to `shared/landing-preview/` and opened in the browser
tool. Nothing under `.lp-preview/` is committed.
