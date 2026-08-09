// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', 'src/db/migrations'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow unused args when prefixed with `_` (Express _next etc.)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Express type augmentation requires `declare global { namespace Express { ... } }`.
      '@typescript-eslint/no-namespace': 'off',
    },
  },
);
