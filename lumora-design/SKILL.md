---
name: lumora-design
description: Design and build LUMORA's website and web app UI in the "Clean" editorial style (whitespace-first, typographically precise, no AI-template look) using LUMORA's brand colors, Arabic-first RTL typography and Motion animations. Use whenever the task involves LUMORA pages, components, landing page, dashboard UI, styling, typography, animation, or visual polish. Always read DESIGN.md in this folder first and do not design LUMORA UI from memory.
version: 1.0.0
---
# LUMORA Design Skill (Clean style, LUMORA identity)

Adapted from a generic "Clean" design skill. The clarifying-questions step is removed: the answers below are already decided. `DESIGN.md` (same folder) holds the exact tokens; this file holds the process and rules.

## Precedence
1. `LUMORA-CONSTITUTION.md` and `AGENTS.md` (architecture, security, scope) win over this skill.
2. The task prompt's specific instructions for a given page (for example the hero redesign prompt) win over this skill for that page.
3. This skill and `DESIGN.md` govern everything else visual.

This skill changes the visual layer only. Never touch Supabase, authentication, RLS, schema or production data as part of design work.

## Decided answers (do not ask again)
- Product: LUMORA, an intelligent teaching assistant for teachers in Bahrain (intermediate stage first).
- Audience: teachers; tone is calm, credible, academic.
- Palette: Deep Navy `#1D2A44`, Bahraini Red `#DA291C`, Educator Purple `#4B1E61`, Lumora Gold `#D4AF37` (decoration only), Off-White `#F8F9FA`, white. See `DESIGN.md`.
- Language: Arabic first, RTL; full English LTR version.
- Fonts: Arabic display El Messiri (confirm by specimen against Noto Kufi Arabic, Markazi Text, Cairo; Reem Kufi excluded), Arabic body IBM Plex Sans Arabic, English IBM Plex Sans.
- Theme: light mode, with the hero's navy zone and a Deep Navy footer.
- Stack: the existing Next.js App Router + TypeScript + Tailwind + shadcn/ui project. Not a single-file HTML artifact.
- Animation: Motion (motion.dev) for sequences, CSS for hover states.

## Process
1. Read `DESIGN.md`, then inspect the existing components, Tailwind config and global CSS. Reuse what works; replace what contradicts the tokens.
2. Put tokens in one place (CSS variables + Tailwind theme extension). No hard-coded hex values in components.
3. Lock typography first (specimen test, then `next/font`). Do not polish anything else on top of generic fonts.
4. Build section by section using the patterns below, in Arabic RTL first, then verify English LTR.
5. Add motion last, after layout and typography are right.
6. Render the app, take screenshots at 1440 / 1024 / 768 / 390 / 360, inspect, fix, repeat. Never claim visual verification without rendering.
7. Report honestly what still falls short.

## Layout patterns (RTL-aware)
- **Hero**: eyebrow → 2-line headline with one accented word in red → short paragraph → red primary + outline secondary CTA. Supplied lightbulb image (mirrored for RTL) with floating product panels. No lifestyle photography.
- **Features**: four items, each with a soft tinted icon disc, title, one sentence, "المزيد". Not a generic identical-card grid: vary emphasis, use hairline dividers.
- **How it works**: numbered steps in large muted numerals, one numeral style across the site.
- **Why LUMORA**: editorial block with the real product benefits only.
- **FAQ**: accordion with hairline rules.
- **Footer**: Deep Navy, large display-size real contact line, link columns, Privacy Policy and Terms, SVG social icons.
- **Do not build**: logo strips, testimonials, star ratings, customer counts, or pricing cards unless the owner supplies real content. Never invent statistics, claims or social proof.

## Micro-animations (mandatory, restrained)
Use `transform` and `opacity` only. Always wrap in a reduced-motion check.
```ts
// Motion (motion.dev): hero entrance
import { animate, stagger } from "motion";
animate(".hero-item", { opacity: [0, 1], transform: ["translateY(20px)", "none"] },
        { duration: 0.6, delay: stagger(0.12, { startDelay: 0.1 }), ease: "easeOut" });
```
```css
/* Scroll reveal: direction-neutral, works in RTL */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .55s ease, transform .55s ease; }
.reveal.visible { opacity: 1; transform: none; }
.card { transition: transform .2s ease, box-shadow .2s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(29,42,68,.10); }
button:active { transform: scale(.98); }
/* Underline draws from the inline-start edge, correct in RTL and LTR */
.nav-link { position: relative; }
.nav-link::after { content: ""; position: absolute; inset-inline-start: 0; bottom: -2px; width: 0; height: 1px; background: currentColor; transition: width .22s ease; }
.nav-link:hover::after, .nav-link[aria-current="page"]::after { width: 100%; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } .reveal { opacity: 1; transform: none; } }
```
Bulb float/glow, particle drift and pointer parallax follow `DESIGN.md` (desktop only for parallax).

## Anti-AI-slop rules (non-negotiable)
**Never**: emoji; sparkle or "AI" badge icons; gradients in UI (except the hero image fade and the logo); gradient blobs, glowing orbs, neon borders; rainbow-bordered cards; glassmorphism everywhere; identical rounded rectangles; huge icons with paragraph text; heavy or colored shadows; `border-radius` 24px+ on everything; letter-spacing on Arabic text; Inter, Roboto, Arial, system-ui; bold on everything; text over the hero image without a contrast check; generic headlines like "Get Started Today".

**Always**: whitespace first; inline SVG Lucide-style icons (1.5 stroke); hover, active and focus state on every interactive element; logical CSS properties; mirrored directional icons in RTL; real Arabic copy written natively (not translated); correct shadda and diacritics (for example يُسهِّل); AA contrast; mobile recomposed, not merely shrunk.

## Definition of done
- Tokens only from `DESIGN.md`; official logo unchanged.
- Arabic renders correctly (joined letters, no clipping, balanced headings, no truncated buttons).
- RTL is genuine (logical properties, mirrored icons) and the English LTR version works.
- Motion is purposeful and respects reduced motion.
- No horizontal overflow at 360px; keyboard focus visible.
- Existing functionality intact; screenshots reviewed; remaining shortcomings listed honestly.