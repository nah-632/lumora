# Premium brief — the landing first screen

Everything here is **measured**, not chosen. The measurements come from the two
files in `docs/design/reference/` and from screenshots of the rendered page.

- `landing-mock.png` — the owner's reference mockup, 1672 × 941. Reference only:
  it is never served and never used as a page image.
- `landing-hero-bg.png` — the text-free artwork, 1672 × 941, RGBA. This IS the
  hero background.

The reference frame is **1672 × 941**. Every offset below is a percentage of that
frame, so it holds at any width.

---

## 1. Extension tokens, sampled from the reference

Method: the named region is cropped from `landing-mock.png`, and the token is the
**median of the darkest eighth** of that region (the ink, not the ground). All
coordinates are pixels in the 1672 × 941 frame, `x0,y0 → x1,y1`.

| Token | Measured | Sampled from | Region |
|---|---|---|---|
| `--lumora-purple-900` | `#23033F` | mockup headline | `150,195 → 590,250` |
| `--lumora-purple-800` | `#2F0B49` | mockup highlighted card body (card 2, clear of text) | `715,600 → 745,660` |
| `--lumora-lavender-100` | `#F5E9F4` | mockup strip surface | `100,880 → 1300,935` |
| `--lumora-lavender-300` | `#E7D1E5` | mockup strip upper band | `1100,815 → 1300,850` |
| `--lumora-gold-300` | `#FAD28F` | gold button, top edge | point `(98,550)` |
| `--lumora-gold-500` | `#F1BD70` | gold button, mid | point `(98,570)` |
| `--lumora-gold-700` | `#E8AA57` | gold button, lower band | `100,590 → 120,598` |

Supporting measurement, not a token — the **card surface**. The reference cards
are translucent white over the artwork, so their measured value moves with what
is behind them: `#F9EEEF`, `#F8E8E4`, `#F8E7E2` and `#FBEEEB` at the four card
positions. That range is what the 92% white baseline and the 76% + blur glass
treatment were matched against, and why the featured card is opaque
`purple-800` instead: at 76% white the artwork moved it out of that range.

The tokens live in `src/design/tokens.ts` (the source of truth) and in `:root` of
`src/styles/globals.css`. Nothing else in the landing stylesheet contains a
literal hex — it is all `var(--lumora-*)`, `white`, `black` or `transparent`.

---

## 2. Assets

The artwork was converted locally with Pillow. No package was installed.

| File | Size | Bytes | Crop |
|---|---|---|---|
| `public/images/landing-hero-desktop.webp` | 1672 × 941 | 289 KB | full frame, q76 |
| `public/images/landing-hero-tablet.webp` | 1200 × 675 | 166 KB | full frame, q76 |
| `public/images/landing-hero-mobile.webp` | 900 × 562 | 96 KB | `700,95 → 1600,657`, centred on the skyline, q76 |

Targets were mobile under ~200 KB and desktop under ~450 KB; both are met with
room to spare, so the quality was not pushed down to hit them.

The three crops are selected by `<picture>` media queries rather than by CSS,
because a CSS swap still downloads the wrong file and an element swap downloads
both. The image is the LCP element: `priority`, `fetchPriority="high"`,
`sizes="100vw"`, `alt=""`, and a flat `lavender-100` surface sits behind it so
there is no flash before it decodes. **The artwork has a large transparent
region on its left** — 119,211 of 1,573,352 pixels are fully transparent, and at
y=200 the first opaque column is x=564. That transparency is what shows the
fallback colour, and it is why the text column has a clean, flat ground.

---

## 3. Text contrast, measured from rendered pixels

Read from the screenshots in `shared/landing-qa/`, not from the tokens. For each
block the script takes the pixels inside its bounding box, splits them into the
darkest 2.5% (the ink) and the lightest half (the ground), and reports the WCAG
ratio between the two medians. The ground is therefore the **actual artwork
behind that text at that width**.

| Width | Block | Ink | Ground | Ratio | Requirement |
|---|---|---|---|---|---|
| 1672 ar | headline | `#1C0034` | `#F4E8F2` | **16.08:1** | 3:1 (large) |
| 1672 ar | subtext | `#260B39` | `#EDE0EC` | **13.85:1** | 4.5:1 |
| 1672 ar | chip labels | `#1D0830` | `#F6ECF4` | **16.13:1** | 4.5:1 |
| 1672 ar | strip | `#200536` | `#F0E1EE` | **14.70:1** | 4.5:1 |
| 1440 ar | headline | `#1C0033` | `#F4E8F2` | **16.11:1** | 3:1 |
| 1440 ar | subtext | `#260B37` | `#EBDBE9` | **13.36:1** | 4.5:1 |
| 1440 ar | chip labels | `#1C062E` | `#F6ECF4` | **16.33:1** | 4.5:1 |
| 1440 ar | strip | `#210737` | `#F4E8F2` | **15.36:1** | 4.5:1 |
| 1024 ar | headline | `#1E0036` | `#F2DFEA` | **14.90:1** | 3:1 |
| 1024 ar | subtext | `#2D0B34` | `#E6CEE1` | **11.81:1** | 4.5:1 |
| 1024 ar | chip labels | `#220A32` | `#F5E9F6` | **15.44:1** | 4.5:1 |
| 1672 en | headline | `#1B0031` | `#F5E9F3` | **16.35:1** | 3:1 |
| 1672 en | subtext | `#290E3D` | `#F3E7F1` | **14.30:1** | 4.5:1 |
| 1672 en | chip labels | `#280D3B` | `#EBDCE8` | **13.16:1** | 4.5:1 |
| 1672 en | strip | `#200535` | `#EFE0EE` | **14.60:1** | 4.5:1 |

**The fog never needed help.** Every block clears AA by a wide margin, so the
"add a flat translucent surface behind the text" fallback was not used for the
text column. It IS used for the strip (`lavender-100` at 92%), because the strip
text is small and the water reflection underneath it varies.

Focus ring: no single brand colour passes on both surfaces. `purple-900` on the
dark featured card is 1.09:1 and every gold in the ramp is under 3:1 on lavender.
The ring is therefore two-tone — a 2px `purple-900` outline with a 5px
`gold-500` halo — which measures 10.6:1 on light surfaces and 9.7:1 on the
featured card.

---

## 4. Measured offsets against the mockup

Frame 1672 × 941. Values are percentages of the frame; the reference column is
read off the mockup at the same frame size.

| Element | Reference (y0–y1) | **ar** measured | **en** measured | Δ |
|---|---|---|---|---|
| badge | 13.9 – 17.6 | 13.9 – 18.6 | 13.9 – 18.6 | +0.0 / +1.0 |
| headline | 20.0 – 37.0 | 19.4 – 37.2 | 19.5 – 37.2 | −0.6 / +0.2 |
| subtext | 37.7 – 45.7 | 38.0 – 47.0 | 38.0 – 47.0 | +0.3 / +1.3 |
| chips | 48.0 – 55.2 | 48.0 – 54.5 | 48.0 – 54.5 | +0.0 / −0.7 |
| buttons | 57.9 – 63.8 | 55.6 – 61.5 | 55.5 – 61.5 | −2.3 / −2.3 |
| cards row | 58.0 – 81.0 | 58.0 – 81.0 | 58.0 – 81.0 | exact |
| strip | 85.5 – 100 | 85.5 – 100 | 85.5 – 100 | exact |
| card row x | 30.1 – 94.1 | 30.1 – 94.1 | 30.1 – 94.1 | exact |

Every element is inside the ~3% tolerance. The button row is the largest
difference at −2.3%, because the row has to clear the card row horizontally
before it can sit as low as the reference does.

Horizontal positions are deliberately **not** compared: the reference lays its
Arabic text out physically left-to-right, whereas this build aligns the text
inside the column to the reading direction. See §6.

---

## 5. The artwork's two defects

### (a) The fog edge

The left edge of the artwork is an alpha boundary, not a painted fog: 7.6% of
the frame is fully transparent, and the boundary runs diagonally (x=564 at
y=200, x=395 at y=300, x=188 at y=400, x=0 at y=600). Because the transparent
part shows the `lavender-100` fallback, the transition is between two flat
surfaces and there is no hard seam to soften.

It was checked at 1672, 1440 and 1024 in the screenshots. No blockiness is
visible, so **no CSS mask was applied** and the file was not touched. The image
is composited at 1:1 at 1672 and scaled by the browser above that; there is no
resampling step that could produce a blocky edge.

### (b) The smudge

A blurry grey artefact sits in the artwork's bottom-right corner, below the dark
purple wave — roughly x 78–100%, y 86–100% of the frame.

It is covered by `.lp-plate`, a dark `purple-800` → `purple-900` block pinned to
the **physical** bottom-right at every breakpoint, which carries the official
logo. The block is 30vw wide on desktop and tablet, which is wider than the
artefact, and the strip band is the same vertical band as the artefact. On
phones the artefact is not present at all: the mobile crop ends at y=657 of 941
and stops well above it.

Verified: `.lp-plate` spans 70–100% of the frame width and 85.6–100% of its
height at 1672, geometrically containing the artefact's 78–100% × 86–100%.

---

## 6. Where this build deliberately differs from the mockup

| Difference | Why |
|---|---|
| Header logo sits on the **reading-order start side** (right in Arabic), not the mockup's physical left | The brief asks for the existing header behaviour, and the logo is a document-flow element that mirrors with the language. The rest of the page is physically fixed; the header bar is the one place where the brand lockup follows the reader. |
| Nav carries two items, not five | `الأسعار` / pricing, `المنتج` / product and `حالات الاستخدام` / use cases have no pages. Sections that do not exist are not listed. |
| No dropdown chevrons | There are no dropdowns. A chevron promises one. |
| No figure | The woman with the tablet is not in the artwork and was not cut out of the mockup. The skyline is the focal point instead. |
| Button row is **right-aligned in Arabic** and ends at x=30.1%, not at the mockup's x=5.3% | The brief requires button order to follow reading direction, so the primary button is the rightmost in Arabic. It is then capped at the point where the card row begins so the two never overlap. In the mockup the row is physically left, which is what allowed it to sit lower. |
| No crown badge on the highlighted card | No usage claim can be made; nothing is measured. |
| No play icon on the secondary button | There is no video. The button scrolls to the tool cards and carries a down arrow. |
| No national emblem; neutral line icons throughout | The coat of arms was on the mockup and is not used. |
| Strip icons alternate gold and purple | The mockup used gold throughout; alternating keeps the gold from reading as decoration and matches the base rule that gold is not a text colour. |
| The featured card is the **second in reading order** | Per the brief. In the mockup it is third from the right. |

---

## 7. What could not be verified here

- **A real mid-range phone.** Everything below 768px was checked by resizing the
  viewport, not on a device. The owner offered to cover this.
- **A live browser's entrance stagger.** The headless renderer available on this
  device never advances the animation clock, so the screenshots are taken with
  `document.getAnimations().forEach(a => a.finish())` — the state a real browser
  settles into. The keyframes themselves were verified to exist and to be
  running; the in-flight frames were not observed.
- **Lighthouse.** `next build` and Playwright both hang this device, and the
  brief forbids `ci.yml` changes, so no Lighthouse run was possible from here.
  The image budget is stated in §2 and the layout reserves its space, but the
  LCP/CLS numbers are not measured and must not be quoted as if they were.
- **The tablet screenshot's first screen.** At 1024 × 768 the page is 945px tall,
  so the strip sits just below the fold; it was measured at 1672 and 1440.
