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
