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
