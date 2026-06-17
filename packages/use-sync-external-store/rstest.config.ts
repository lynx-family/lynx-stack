// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const require = createRequire(import.meta.url);

// `internal-preact` (aliased to `preact`) ships both a CJS (`require`) and an
// ESM (`import`) build. Under rstest/rspack the preact CORE can be pulled in via
// both conditions, producing two `options` singletons — hooks then register on
// one copy while the diff path reads the other (`Cannot read … '__H'`). Force
// every preact subpath to its single `.mjs` build so the whole graph shares one
// instance (the same `.js`→`.mjs` rewrite vitest's testingLibraryPlugin did).
const reactRequire = createRequire(
  require.resolve('@lynx-js/react/package.json'),
);
const preactSingletonAlias = Object.fromEntries(
  ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map((
    sub,
  ) => [`${sub}$`, reactRequire.resolve(sub).replace(/\.js$/, '.mjs')]),
);

const config: RstestConfig = defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        plugins: [...(config.plugins || []), pluginReactLynx()],
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            ...preactSingletonAlias,
            vitest: require.resolve('./vitest-polyfill.cjs'),
          },
        },
        name: 'use-sync-external-store',
        include: ['test/**/*.test.{js,ts,jsx,tsx}'],
      };
    },
  }),
});

export default config;
