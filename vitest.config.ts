import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = { '@': path.resolve(import.meta.dirname, 'src') };

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      thresholds: { lines: 95 },
    },
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/helpers/setup.ts'],
          environment: 'node',
          pool: 'forks',
          testTimeout: 20000,
        },
      },
    ],
  },
});
