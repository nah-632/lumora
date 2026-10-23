import type { Config } from "tailwindcss";

/**
 * SERVO Design Tokens — single source of truth (§2 of the master prompt).
 * Deep-navy dominance, restrained sand-gold accents, warm neutral surfaces.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#082D44",
        teal: "#0E5A7A",
        "sand-gold": "#D4B483",
        "warm-white": "#F8F6F2",
        charcoal: "#17232C",
        success: "#1F7A4D",
        warning: "#B4762A",
        danger: "#B03A2E",
        info: "#0E5A7A",
        neutral: {
          50: "#FAF9F7",
          100: "#F3F1ED",
          200: "#E5E1DA",
          300: "#D0CAC0",
          400: "#A8A199",
          500: "#7E7870",
          600: "#5D5851",
          700: "#45413C",
          800: "#2E2B27",
          900: "#17232C",
        },
      },
      fontFamily: {
        sans: ["var(--font-latin)", "var(--font-arabic)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "var(--font-latin)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(8 45 68 / 0.06)",
        DEFAULT: "0 2px 8px 0 rgb(8 45 68 / 0.10)",
        lg: "0 8px 24px 0 rgb(8 45 68 / 0.14)",
      },
      transitionDuration: { brand: "250ms" },
      maxWidth: { content: "72rem" },
      zIndex: { nav: "100", drawer: "200", modal: "300", toast: "400" },
    },
  },
  plugins: [],
};
export default config;
