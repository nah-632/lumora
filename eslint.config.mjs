import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "build-test/**"],
  },
  {
    rules: {
      // Arabic and English copy both live in the catalogs; no raw user-facing
      // strings should be introduced in a component.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
