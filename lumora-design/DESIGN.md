# LUMORA Design Guidelines — Clean style, LUMORA identity

Clean, editorial, whitespace-first. Adapted from the supplied "Clean" guidelines: the structure, spacing and restraint are kept; colors, typography, direction (RTL) and content rules are replaced with LUMORA's.

## Visual style
- **Mood**: calm, intelligent, trustworthy, academic, human-centered. Editorial, not cold.
- **Primary language**: Arabic, RTL. English is a full LTR version, not an afterthought.
- **Rhythm**: white and Off-White sections alternate; color is used for meaning, not decoration.

## Color palette (brand-locked)
| Token | Hex | Use |
|---|---|---|
| `--navy` | `#1D2A44` | Headings, primary text, dark buttons, footer, hero's dark zone |
| `--red` | `#DA291C` | Primary CTA, one accented word per headline, active nav underline |
| `--purple` | `#4B1E61` | Links, focus rings, hover/active states, interactive details |
| `--gold` | `#D4AF37` | Decoration only (thin rules, hero particles echo). Never as text on white (fails contrast) |
| `--offwhite` | `#F8F9FA` | Alternate section background |
| `--bg` | `#FFFFFF` | Page background |
| `--text` | `#1D2A44` | Primary text |
| `--text-secondary` | `#4F5871` | Body copy |
| `--text-muted` | `#6B7388` | Captions, labels (use on white only) |
| `--border` | `#E3E6EC` | 1px structure on cards and inputs |

- Neutrals are navy-tinted (cool), not the warm grays of the original guidelines.
- Rule of three: **white/off-white + navy + red**. Purple is for interaction states, gold for rare decoration.
- Tints for icon discs: navy, red and purple at about 8% opacity on white.
- **No gradients in the UI.** The only gradients: the hero image's own fade, and the official logo.
- Contrast: all text at WCAG AA or better; verify navy/red/purple pairs and any text over the hero image with a contrast checker.

## Typography
- **Arabic display (H1–H3)**: El Messiri (lead candidate; confirm against Noto Kufi Arabic, Markazi Text and Cairo with a specimen page before locking). Reem Kufi is excluded by the owner.
- **Arabic body/UI**: IBM Plex Sans Arabic. **English**: IBM Plex Sans (matches proportions).
- Load with `next/font`, arabic + latin subsets, `display: swap`.
- Scale (fluid): H1 `clamp(40px, 5.5vw, 80px)`, H2 `clamp(28px, 3vw, 44px)`, H3 20–26px, body 16–18px, caption 13–14px.
- Line height: display 1.25–1.35, body 1.75 (Arabic needs more than Latin).
- Weights: at most three in use (for example 400, 500, 700). Do not make everything bold.
- **Arabic letter-spacing is always 0.** Negative or positive tracking breaks joined letterforms. Overline labels are small and muted but not uppercase in Arabic; uppercase + 0.08em tracking applies to the English version only.
- `text-wrap: balance` on headings; deliberate line breaks in the hero headline.
- Pick one numeral style (Western or Arabic-Indic) and use it everywhere, including step numbers (01 / ٠١).
- Never: Inter, Roboto, Arial, system-ui, Space Grotesk, Geist/DM Sans for Arabic text.

## Layout and spacing
- Base unit 8px. Section padding 96–128px desktop, about 64px mobile. Container max 1200px, 24px side padding.
- Card padding 28–32px. Feature grids 2–4 columns; single column below 768px.
- Use CSS logical properties everywhere (`margin-inline-start`, `padding-inline`, `inset-inline-end`). No hard-coded left/right.

## Borders, radius, shadows
- Radius: cards 12px, buttons and inputs 8px, badges 100px. No pill buttons.
- Borders: 1px `--border`, structure only.
- Shadows: `0 1px 3px rgba(29,42,68,.06), 0 1px 2px rgba(29,42,68,.04)`; hover `0 6px 20px rgba(29,42,68,.10)`; panels `0 8px 30px rgba(29,42,68,.10)`. Navy-tinted, never colored or heavy.

## Buttons
- **Primary**: `--red` background, white text, 8px radius, 12/24px padding, weight 500. Hover: slightly darker red. Active: `scale(0.98)`.
- **Dark** (login): `--navy` background, white text.
- **Secondary**: transparent, 1px `--border` (or navy), navy text; hover background `--offwhite`.
- Focus: 2px `--purple` ring with offset, always visible. Transition 0.18s ease. Arabic labels never truncate.

## Icons
- Lucide-style inline SVG: 24×24, stroke `currentColor`, 1.5 stroke width, round caps and joins. No emoji, no icon fonts, no sparkle or "AI" badge icons.
- Directional icons (arrows, chevrons) are mirrored in RTL.
- Feature icons sit in a soft 8% tinted disc (navy, red or purple per feature); this is the one allowed exception to "no colored icon backgrounds".

## Components
- **Header**: sticky, white. In RTL the logo is on the right (start); links centered (الرئيسية، الميزات، الأسعار، الأسئلة الشائعة، تواصل معنا); on the left: EN switch and navy login button. Active link = small red underline, not a button. Subtle rule or shadow after scroll. Mobile: full-height sheet menu.
- **Hero**: overline eyebrow → large headline (2 lines, one accented word in red) → short paragraph → two CTAs (red primary + outline secondary). The supplied lightbulb-with-palm image is the only hero visual; it is mirrored for RTL so the headline sits on the light side. Floating product panels (student progress, lesson plan, quiz generator) with sample data sit around the bulb.
- **Features**: four items (متابعة الطلاب، تنبيهات ذكية، خطة الدروس، إنشاء الاختبارات): tinted icon disc, title, one sentence, "المزيد" link. Thin dividers, no heavy boxes.
- **How it works**: large muted numbers, title, short description, alongside a product panel.
- **FAQ**: accordion, hairline rules between items, no card borders.
- **Contact / footer**: footer in Deep Navy, large display-size contact line (only a real email supplied by the owner), link columns, legal links (Privacy Policy, Terms), SVG social icons. Gold hairline accent allowed.
- **Omit** logo strips, testimonials, ratings, customer counts and pricing cards unless the owner supplies real content. Never invent social proof, statistics or prices.

## Imagery
- Hero: only the supplied lightbulb-with-palm image. The official logo is used as supplied, unchanged.
- No stock photos, no generated images, no real student photos or names (sample data in panels is clearly generic).
- Avatars, if ever needed: initials in a circle.

## Motion
Use Motion (motion.dev) for sequences; CSS for simple hover states. Animate only `transform` and `opacity`.
- Hero load: eyebrow → headline (line by line) → paragraph → CTAs → panels, delays about 0.1 / 0.22 / 0.34s, panels staggered after.
- Bulb: slow idle float and a soft glow pulse; gold particles on a slower layer; pointer parallax on desktop only.
- Scroll reveal: fade-up 24px, 0.55s ease, threshold 0.12, children staggered 0 / 0.08 / 0.16 / 0.24s.
- Card hover: `translateY(-2px)` + shadow, 0.2s. Nav link underline draws from the **inline-start** edge. Accordion: max-height + opacity 0.35s; icon rotates 45°.
- `prefers-reduced-motion`: replace movement with simple fades or nothing; no parallax or particle drift on touch devices.

## Replication notes
- Whitespace and typography do the heavy lifting; size contrast between H1 and body is dramatic.
- Every interactive element has hover, active and focus states.
- No new colors beyond the table above.
- Test at 1440, 1024, 768, 390 and 360 px, in Arabic RTL and English LTR.
