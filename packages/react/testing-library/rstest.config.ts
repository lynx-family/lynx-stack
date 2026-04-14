import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withDefaultConfig } from './src/rstest-config.ts';

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
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
          ...(config.plugins || []),
          pluginReactLynx(),
        ],
        source: {
          ...config.source,
          define: {
            ...config.source?.define,
            __ALOG__: 'true',
          },
        },
        resolve: {
          ...config.resolve,
          // in order to make our test case work for
          // both vitest and rstest, we need to alias
          // `vitest` to `@rstest/core`
          alias: {
            ...config.resolve?.alias,
            vitest: require.resolve('./vitest-polyfill.cjs'),
          },
        },
        include: ['src/**/*.test.{js,jsx,ts,tsx}', '!src/__tests__/3.1/**/*.{js,jsx,ts,tsx}'],
      };
    },
  }),
});
