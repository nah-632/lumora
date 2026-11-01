# LUMORA — Design System

## Visual world
Editorial, calm and trustworthy. Large quiet surfaces, confident typography, and
colour used to carry meaning rather than decoration. It should read as a tool a
teacher trusts with a child's record, not as a marketing page.

## Colour tokens (source of truth: src/design/tokens.ts)
| Role | Token | HEX | Constraint |
|---|---|---|---|
| Interactive / national | red | #DA291C | primary actions, national accents |
| Primary / trust | navy | #1D2A44 | navigation, dark surfaces |
| Creativity / education | purple | #4B1E61 | secondary surfaces, accents |
| Details / inspiration | gold | #D4AF37 | DECORATIVE ONLY — fails AA for text |
| Background | offWhite | #F8F9FA | page ground |

System states (permitted outside the brand palette): success #1B7F4B,
warning #9A6400, error #B3261E, info #1D4E89.

**Absolute rule:** gold must never carry body text. Navy on off-white is 12.4:1;
red on off-white is 4.6:1. Any new pair must be measured, not assumed.

## Typography
At most two families. Arabic: IBM Plex Sans Arabic. Latin: a matching sans.
Four to five sizes only. Arabic needs more line-height than Latin; never apply
letter-spacing to Arabic.

## Spacing and shape
Strict 8px scale (4/8/12/16/24/32/48/64). Radii 6/10/16/pill. One shadow system.

## Direction
RTL and LTR are architectural, not a translation step. Logical CSS properties
only (margin-inline, padding-inline, inset-inline, text-align: start/end). Never
hard-code left or right. Mirror directional icons; never mirror the logo.

## Motion
150–250ms, purposeful, and always respecting prefers-reduced-motion. Reveal
animations must default to visible so a no-JS or failed-hydration render is
complete rather than blank.

## Operate-mode priorities for this surface
Scanability over expression. Dense but breathable tables. Skeleton loading,
designed empty states, and error states that say what to do next.

## Anti-patterns banned here
Gradient blobs, emoji as icons, identical three-card grids, fake statistics,
testimonials, placeholder partner logos, and any trace of automated generation.

## Owner-approved landing exceptions (2026-11-01)

The landing page's first screen — header, hero, the four tool cards and the
benefit strip — was rebuilt to the owner's reference mockup. The owner approved
the following on that surface, and **only** on that surface. They are not a
general relaxation of this document:

- Gradients (the gold button ramp, the logo plate, the card glows).
- Glass-like translucent cards (`backdrop-filter` from 768px up, where
  supported; a solid 92% white card everywhere else).
- Gold buttons and gold accents, including gold carrying the button label.
- A purple-and-gold treatment around a photographic hero background.

Still binding on that surface, unchanged: El Messiri / IBM Plex Sans Arabic /
IBM Plex Sans only; Arabic takes no letter-spacing and no italics; body
line-height ≥ 1.6 and the display headline ≥ 1.15; no text under 12px; AA
contrast; 44px tap targets; reduced motion; the logo is never recoloured or
redrawn.

Seven extension tokens were added for it — `purple-900`, `purple-800`,
`lavender-100`, `lavender-300`, `gold-300`, `gold-500`, `gold-700`. Every one is
**measured** from the reference, not chosen; the values, the sampling positions
and the measured text contrast are recorded in
[`docs/design/premium-brief.md`](docs/design/premium-brief.md).

The base rule that gold never carries body text still holds everywhere else.
Inside the landing surface the gold button carries its label at 10.6:1, which is
a measurement rather than an exemption.
