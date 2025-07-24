import { defineConfig } from '@rstest/core';

export default defineConfig({
  testEnvironment: 'node',
  source: {
    define: {
      __DEV__: false,
    },
  },
});
