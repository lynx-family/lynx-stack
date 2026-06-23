import { defineConfig } from '@rstest/core';

export default defineConfig({
  projects: [
    './rstest.config.compiler-enabled.ts',
    './rstest.config.compiler-disabled.ts',
  ],
});
