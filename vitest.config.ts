import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/tests/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
