import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

const require = createRequire(import.meta.url);

export default defineConfig({
  name: 'testing-library/examples/react-compiler-enabled',
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
