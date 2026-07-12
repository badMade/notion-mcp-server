import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      'prefer-const': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'no-undef': 'off',
      'preserve-caught-error': 'off',
    },
    ignores: ["node_modules/", "dist/", "build/"]
  }
);
