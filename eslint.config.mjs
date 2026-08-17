import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/', 'build/', 'node_modules/']
  },
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
);
