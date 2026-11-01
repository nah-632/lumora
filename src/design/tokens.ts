/**
 * LUMORA design tokens — the single source of truth for brand colour.
 * Tailwind reads these via tailwind.config.ts; components consume CSS variables.
 *
 * Accessibility: --lumora-gold fails WCAG 2.2 AA contrast against light surfaces
 * for body text, so it is reserved for decorative accents, rules and icon fills.
 * Measured pairs live in DESIGN.md.
 */
export const tokens = {
  colors: {
    /** Interactive actions, national accents. 4.6:1 on offWhite. */
    red: "#DA291C",
    /** Primary surface for navigation and dark sections. 12.4:1 on offWhite. */
    navy: "#1D2A44",
    /** Creative / educational accents. 11.1:1 on offWhite. */
    purple: "#4B1E61",
    /** Decorative only — fine rules, icon fills, highlights. Never body text. */
    gold: "#D4AF37",
    /** Page ground. */
    offWhite: "#F8F9FA",

    /* ----------------------------------------------------------------------
       Landing-page extension tokens — OWNER-APPROVED for the landing page
       (2026-11-01). They deliberately permit on that surface what the base
       palette forbids: gradients, translucent glass cards, gold buttons and
       gold accents, and a purple-and-gold treatment.

       Every value below is MEASURED from the owner's reference mockup, not
       chosen. Sampling positions and the measurement method are recorded in
       docs/design/premium-brief.md. Do not round these to a "nicer" value —
       the point is that they come from the artwork.
       ---------------------------------------------------------------------- */

    /** Headline ink. Measured: mockup headline set, x150-590 y195-250. */
    "purple-900": "#23033F",
    /** Highlighted card fill. Measured: mockup card 2 body, x715-745 y600-660. */
    "purple-800": "#2F0B49",
    /** Light tint ground (badge, chips, strip). Measured: mockup strip x100-1300 y880-935. */
    "lavender-100": "#F5E9F4",
    /** Mid tint / hairline. Measured: mockup strip upper band x1100-1300 y815-850. */
    "lavender-300": "#E7D1E5",
    /** Gold button ramp, top edge. Measured: mockup button (98,550). */
    "gold-300": "#FAD28F",
    /** Gold button ramp, mid. Measured: mockup button (98,570). */
    "gold-500": "#F1BD70",
    /** Gold button ramp, lower band. Measured: mockup button x100-120 y590-598. */
    "gold-700": "#E8AA57",
  },
  /** System states, permitted outside the brand palette by spec. */
  states: {
    success: "#1B7F4B",
    warning: "#9A6400",
    error: "#B3261E",
    info: "#1D4E89",
  },
  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    pill: "999px",
  },
  /** 8px base scale. */
  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    6: "24px",
    8: "32px",
    12: "48px",
    16: "64px",
  },
  motion: {
    fast: "150ms",
    base: "200ms",
    slow: "250ms",
  },
} as const;

export type TokenColor = keyof typeof tokens.colors;
export type TokenState = keyof typeof tokens.states;
