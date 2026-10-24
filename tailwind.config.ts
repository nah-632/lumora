import type { Config } from "tailwindcss";
import { tokens } from "./src/design/tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        red: tokens.colors.red,
        navy: tokens.colors.navy,
        purple: tokens.colors.purple,
        gold: tokens.colors.gold,
        paper: tokens.colors.offWhite,
        success: tokens.states.success,
        warning: tokens.states.warning,
        danger: tokens.states.error,
        info: tokens.states.info,
      },
      borderRadius: { sm: tokens.radius.sm, md: tokens.radius.md, lg: tokens.radius.lg, pill: tokens.radius.pill },
      fontFamily: {
        // next/font sets these variables; the fallbacks keep Arabic legible
        // before the webfont resolves.
        sans: ["var(--font-latin)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "system-ui", "sans-serif"],
      },
      transitionDuration: { fast: tokens.motion.fast, base: tokens.motion.base, slow: tokens.motion.slow },
    },
  },
  plugins: [],
};
export default config;
