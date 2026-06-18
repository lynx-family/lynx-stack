import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  name: 'testing-library/examples/react-compiler-disabled',
  extends: withLynxConfig({
    configPath: './lynx.config.ts',
  }),
  source: {
    define: {
      __FORGET__: 'false',
    },
  },
});
