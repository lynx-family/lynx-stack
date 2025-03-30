import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'webpack/chunk-loading',
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
  },
});
