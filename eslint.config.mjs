import globals from "globals";
import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "bin/**",
      "coverage/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    extends: [
      eslintJs.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.vitest,
        ...globals.browser,
      },
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-useless-assignment": "off",
      "no-empty": "off",
      "preserve-caught-error": "off",
    },
  }
);
