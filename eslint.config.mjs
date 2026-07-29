import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'prefer-const': 'off',
      'no-undef': 'off',
      'preserve-caught-error': 'off',
      '@typescript-eslint/no-unused-expressions': 'off'
    },
    ignores: [
      'build/**',
      'dist/**',
      'coverage/**',
      'bin/**',
      'node_modules/**',
      '*.log',
      'scripts/build-cli.js',
      'examples/**'
    ],
  }
);
