import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["build/**", "dist/**", "coverage/**", "bin/**", "node_modules/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
        ...globals.vitest,
      },
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-useless-assignment": "off",
      "no-empty": "off",
      "preserve-caught-error": "off"
    },
  }
);
