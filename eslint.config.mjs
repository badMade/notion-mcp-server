import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'build/**',
      'dist/**',
      'bin/**',
      'coverage/**',
      'node_modules/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest
      }
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
);
