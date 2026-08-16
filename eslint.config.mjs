import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    ignores: ['node_modules/', 'bin/', 'dist/', 'build/', 'coverage/']
  }
);
