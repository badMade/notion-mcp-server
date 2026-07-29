import js from "@eslint/js";
import globals from "globals";
import tsEslint from "typescript-eslint";

export default [
  {
    ignores: ["build/**", "dist/**", "coverage/**", "bin/**"]
  },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
        ...globals.vitest
      }
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
      "no-useless-assignment": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  }
];
