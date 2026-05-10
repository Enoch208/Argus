// Strict boundary rules per docs/CODE-RULES.md and docs/STRUCTURE.md.
// The renderer cannot import from main/preload; main cannot import from renderer.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["out/**", "dist/**", "node_modules/**", "*.config.{js,ts,mjs}"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // CODE-RULES §TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "off", // requires type info; enable in tsc-aware runs

      // CODE-RULES §Imports — no default exports for components
      "import/no-default-export": "warn",

      // React
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // STRUCTURE.md: renderer must NOT reach into main or preload.
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/main/*", "@/preload/*"],
              message:
                "The renderer cannot import from main or preload. Cross the IPC boundary via @/renderer/ipc/client.ts.",
            },
          ],
        },
      ],
    },
  },

  // STRUCTURE.md: main must NOT depend on renderer code.
  {
    files: ["src/main/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/renderer/*"],
              message:
                "The main process never imports from the renderer. UI types belong in @/shared/types/.",
            },
          ],
        },
      ],
    },
  },

  // index.html / route entry files may default-export.
  {
    files: ["src/renderer/routes/**/index.tsx", "src/renderer/main.tsx"],
    rules: { "import/no-default-export": "off" },
  },
);
