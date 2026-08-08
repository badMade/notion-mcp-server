import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
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
      "preserve-caught-error": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-this-alias": "off",
      "no-useless-assignment": "off",
      "no-undef": "off",
      "no-empty": "off",
      "no-fallthrough": "off",
      "no-case-declarations": "off",
      "no-cond-assign": "off",
      "no-redeclare": "off",
      "no-unsafe-finally": "off",
      "no-control-regex": "off",
      "no-useless-escape": "off"
    }
  },
  {
    ignores: ["dist/", "build/", "coverage/", "node_modules/", "bin/"]
  }
];
