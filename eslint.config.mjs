import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["build/", "dist/", "node_modules/", "coverage/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
      "no-empty": "off",
      "no-fallthrough": "off",
      "no-control-regex": "off",
      "no-cond-assign": "off",
      "preserve-caught-error": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-useless-assignment": "off",
      "no-undef": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
    },
  },
];
