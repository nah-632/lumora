/**
 * LUMORA design tokens — runtime values (§2).
 * Used by UI components; Tailwind config mirrors these.
 */
export const tokens = {
  colors: {
    navy: "#082D44",
    teal: "#0E5A7A",
    sandGold: "#D4B483",
    warmWhite: "#F8F6F2",
    charcoal: "#17232C",
  },
} as const;

export type TokenColor = keyof typeof tokens.colors;
