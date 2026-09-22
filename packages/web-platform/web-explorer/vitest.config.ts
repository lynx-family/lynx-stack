import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    name: 'web-platform/web-explorer',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
