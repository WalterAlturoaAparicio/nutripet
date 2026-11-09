import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      '.next/',
      'dist/',
      'build/',
      'coverage/',
      'public/sw.js',
      'public/swe-worker-*.js',
      'next-env.d.ts',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Domain code must stay pure: no UI framework, ORM, database driver or file I/O.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react/*', 'react-dom', 'next', 'next/*'], message: 'Domain code must not import UI frameworks.' },
            { group: ['drizzle-orm', 'drizzle-orm/*', 'better-sqlite3'], message: 'Domain code must not access the database.' },
            { group: ['node:fs', 'fs', 'node:fs/*'], message: 'Domain code must not do I/O.' },
            { group: ['@/server/*', '@/ui/*', '@/app/*'], message: 'Domain code must not depend on outer layers.' },
          ],
        },
      ],
    },
  },
);
