# Scanner section — skills used, and where they conflicted

Companion note for `design/scanner-section`. Written because the task named ten
skills, several are not installed here, and two of the installed ones contradict
the task's own rules. Where they conflict, the task's rules win; this file records
which, so nobody has to guess later why the code looks the way it does.

## Used

| Skill | Where it is | What it governed here |
|---|---|---|
| `lumora-design` (authority, in-repo at `lumora-design/SKILL.md`) | installed | Tokens only, Arabic-first typography, no gradients in UI, no invented statistics, logical properties, reduced-motion rule, "verify by rendering, never assert" |
| `impeccable` | installed | Anti-slop pass: one accent per meaning, hairline over shadow, no decorative radius inflation |
| `frontend-ui-engineering` | installed | Component structure, container queries for a mini document, transform-only animation, pointer capture |
| `performance-optimization` | installed | Zero-allocation loop, DPR cap, IntersectionObserver + visibility gating, adaptive quality that only steps down |
| `ui-ux-pro-max` | installed | Type scale inside cards, 44px targets, contrast of the pill and the card tones |
| `using-agent-skills` | installed | Which of the above actually applied to a visual-only change |
| `superpowers` | installed | Verification discipline: a claim needs an artefact, not an opinion |

## Named in the brief but not installed here

`design-taste-frontend`, `emil-design-eng`, `motion`, `playwright-cli`,
`design-review`, `verification-before-completion`.

They do not exist at `/var/minis/skills/` under those names (checked). No
substitute was pretended into existence: the closest installed skills were used
(`impeccable` for design review, `performance-optimization` for the budget,
`superpowers` for the completion gate), and their absence is part of why the
visual and performance verification below is owed rather than delivered.

## Conflicts, and how they were resolved

1. **`lumora-design` requires Motion (motion.dev) for sequences. The brief forbids
   new dependencies.** → No animation library. The belt is a `requestAnimationFrame`
   loop using `transform`, `clip-path` and canvas pixels only. Consequence: the
   entrance is hand-written, and it is the part of this section with the most code
   that is not React.

2. **`lumora-design` says "never gradients in UI (except the hero image fade)".**
   The brief asks for an alpha mask that softens the seam and fades the result
   layer. → Both are `mask-image` gradients, which paint **no colour**: they are
   alpha only, so no gradient is visible anywhere in the section. The alternative
   the brief offered (JS-computed opacity) was rejected: it needs a per-frame
   opacity write on eight elements and still does not produce a soft edge.
   **Choice: alpha `mask-image`.**

3. **`lumora-design` says Motion last, after layout and typography.** Kept — the
   static composition is the server-rendered frame, and the loop only takes over
   once the geometry has been measured.

4. **The brief says "tokens only, no new hex values".** The paper card surface
   uses `#ffffff`, which `DESIGN.md` lists as a surface token but which has no CSS
   variable in `landing.css`. It is declared once, with a comment, as
   `--paper-card`; every other colour is a token or a `color-mix()` tint of one.

5. **`docs/design/` could not be created in the working tree** (the sandbox's
   filesystem rejects that directory name with `EEXIST` while `stat` says it does
   not exist). The file was staged at this path through the git index instead, so
   it is in the commit and on GitHub exactly where the brief asked for it. A local
   `git status` in the sandbox may show it as deleted; that is the sandbox, not
   the commit.

## What was verified, and what was not

Verified locally on this device: `tsc --noEmit` clean · `next lint` clean (three
pre-existing `<img>` warnings, none new) · 29 new unit tests pass, and the full
suite passes (267 tests, 0 fail).

**Not** verified locally: `next build`, Playwright screenshots at 360/390/768/1440,
the 4× CPU frame-time p95, and Lighthouse before/after. This device hangs on a
Next build and cannot run Playwright; the brief's instruction is to let CI do it.
They are owed, not done.
