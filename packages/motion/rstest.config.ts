// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const require = createRequire(import.meta.url);
const reactRequire = createRequire(
  require.resolve('@lynx-js/react/package.json'),
);
const preactSingletonAlias = Object.fromEntries(
  ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
    (s) => [`${s}$`, reactRequire.resolve(s).replace(/\.js$/, '.mjs')],
  ),
);

export default defineConfig({
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
        include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
        exclude: ['__tests__/utils/**'],
      };
    },
  }),
});
