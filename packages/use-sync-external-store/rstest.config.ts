import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const require = createRequire(import.meta.url);

// Resolve `preact` (and its sub-paths) to the SINGLE physical copy shipped
// with `@lynx-js/react`. Without this, the bundler pulls a second copy from
// `node_modules/.pnpm`, producing two preact `options` singletons: hooks
// register `_render` on one while the diff path reads the other, so
// `currentComponent` is undefined and `useState` throws
// `Cannot read properties of undefined (reading '__H')`.
const reactRequire = createRequire(
  require.resolve('@lynx-js/react/package.json'),
);
const preactSingletonAlias = Object.fromEntries(
  ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
    (s) => [`${s}$`, reactRequire.resolve(s).replace(/\.js$/, '.mjs')],
  ),
);

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        include: ['test/**/*.test.{js,ts,jsx,tsx}'],
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            ...preactSingletonAlias,
            // Alias `vitest` to `@rstest/core` so test files can keep
            // `import ... from '@rstest/core'`.
          },
        },
        tools: {
          ...config.tools,
          rspack: {
            module: {
              rules: [
                {
                  test: /\.(?:jsx|tsx|ts)$/,
                  use: [
                    {
                      loader: require.resolve('./transform-loader.cjs'),
                    },
                  ],
                },
              ],
            },
          },
        },
      };
    },
  }),
});

export default config;
