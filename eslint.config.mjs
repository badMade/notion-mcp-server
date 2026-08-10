import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "build/", "node_modules/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-useless-assignment": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-this-alias": "off",
      "no-fallthrough": "off",
      "no-case-declarations": "off",
      "no-cond-assign": "off",
      "no-redeclare": "off",
      "preserve-caught-error": "off"
    }
  }
);
