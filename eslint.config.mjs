import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.ts", "scripts/**/*.ts", "scripts/**/*.mjs", "scripts/**/*.js"],
        languageOptions: {
            parser: tsParser,
            globals: {
                process: "readonly",
                console: "readonly",
                global: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "off"
        }
    }
];
