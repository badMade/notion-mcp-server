import eslintJS from "@eslint/js";
import tsEslint from "typescript-eslint";
import globals from "globals";

export default tsEslint.config(
  {
    ignores: ["build/**", "dist/**", "coverage/**", "bin/**", "node_modules/**"]
  },
  eslintJS.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
        ...globals.vitest
      }
    }
  }
);
