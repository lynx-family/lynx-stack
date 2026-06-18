import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  name: 'testing-library/examples/react-compiler-enabled',
  extends: withLynxConfig({
    configPath: './lynx.enable.config.ts',
  }),
  source: {
    define: {
      __FORGET__: 'true',
    },
  },
});
