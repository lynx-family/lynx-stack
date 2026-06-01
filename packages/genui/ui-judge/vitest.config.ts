import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 60_000,
    include: ['tests/**/*.vitest.spec.ts'],
    testTimeout: 60_000,
  },
});
