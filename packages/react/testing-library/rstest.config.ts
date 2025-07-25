import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import type { RsbuildPlugin } from '@rsbuild/core';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    {
      name: 'lynx:testing-library:plugin',
      pre: ['lynx:react'],
      setup(api) {
        api.modifyBundlerChain((chain, { CHAIN_ID, rspack }) => {
          const rule = chain.module.rules.get(CHAIN_ID.RULE.JS);
          const reactTestingRule = rule.oneOfs.get('react:testing');
          const swcUse = reactTestingRule.uses.get('swc');
          const originalOptions = swcUse.get('options');
          const newOptions = {
            ...originalOptions,
            jsc: {
              ...originalOptions.jsc,
              transform: {
                ...((originalOptions.jsc?.transform)
                  || {}),
                // Keep our snapshot consistent with vitest
                // class field will be undefined if not initialized
                useDefineForClassFields: true,
              },
            },
          };
          swcUse.options(newOptions);
        });
      },
    },
  ] as RsbuildPlugin[],
  source: {
    define: {
      __RSTEST__: 'true',
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
