import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from './src/rstest-config.ts';

const require = createRequire(import.meta.url);

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        // The vitest runner's `spyOn` is idempotent when a method is already
        // spied; rstest's is not, so a spy re-installed across loop iterations
        // (e.g. lazy-bundle Suspense map) recurses. Restore spies between tests
        // to match vitest semantics.
        restoreMocks: true,
        tools: {
          ...config.tools,
          swc: {
            jsc: {
              transform: {
                useDefineForClassFields: true,
              },
            },
          },
        },
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
