export default [
  {
    ignores: [
      "build/**",
      "dist/**",
      "coverage/**",
      "bin/**",
      "node_modules/**"
    ]
  },
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly"
      }
    }
  }
];
