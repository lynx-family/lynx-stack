import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'vitest.config.compiler-enabled.ts',
      'vitest.config.compiler-disabled.ts',
    ],
  },
});
