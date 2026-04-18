import { defineConfig } from '@rstest/core';

export default defineConfig({
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('./src/setupFiles/rstest.js'),
  ],
  globals: true,
  resolve: {
    alias: {
      // Allow the shared test files to keep importing from `vitest`.
      vitest: require.resolve('./vitest-polyfill.cjs'),
    },
  },
  include: ['src/**/*.test.{js,jsx,ts,tsx}'],
});
