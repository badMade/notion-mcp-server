import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist/",
      "build/",
      "node_modules/",
      "coverage/",
      "**/*.log"
    ]
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
