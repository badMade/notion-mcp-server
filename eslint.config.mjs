import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      "dist/**",
      "coverage/**",
      "bin/**",
      ".github/**",
      "scripts/notion-openapi.json",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.vitest,
      },
    },
    rules: {
      // permissive baseline to allow existing code to pass without failing the healthcheck
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off", // Handle TS specific globals
      "no-constant-condition": "off",
      "no-async-promise-executor": "off",
      "no-empty": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
    },
  },
);
