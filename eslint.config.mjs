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
        ...globals.jest,
      },
    },
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'scripts/notion-openapi.json',
      'bin/**',
      'node_modules/**'
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      'prefer-const': 'off',
      'preserve-caught-error': 'off',
      'no-useless-catch': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-cond-assign': 'off',
      'no-constant-condition': 'off',
      'no-sparse-arrays': 'off',
      'no-unexpected-multiline': 'off',
      'no-unreachable': 'off',
      'no-useless-escape': 'off',
      'valid-typeof': 'off',
      'no-irregular-whitespace': 'off',
      'no-debugger': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-useless-assignment': 'off',
      'no-undef': 'off',
    },
  },
);
