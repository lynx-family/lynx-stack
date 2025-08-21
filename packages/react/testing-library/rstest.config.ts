import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        transform: {
          useDefineForClassFields: true,
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  source: {
    define: {
      __RSTEST__: 'true',
      __ALOG__: 'true',
    },
  },
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('@lynx-js/react/testing-library/setupFiles/rstest'),
  ],
  globals: true,
  resolve: {
    // in order to make our test case work for
    // both vitest and rstest, we need to alias
    // `vitest` to `@rstest/core`
    alias: {
      vitest: require.resolve('./vitest-polyfill.cjs'),
    },
  },
});
