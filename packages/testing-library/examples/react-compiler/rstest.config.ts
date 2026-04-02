import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  extends: withLynxConfig({
    configPath: './lynx.enable.config.ts',
  }),
  resolve: {
    alias: {
      // not necessary in real projects, just for compatibility with vitest tests in this repo
      vitest: require.resolve('./vitest-polyfill.cjs'),
    },
  },
  source: {
    define: {
      __FORGET__: 'true',
    },
  },
});
