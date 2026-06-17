// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const require = createRequire(import.meta.url);

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        name: 'lynx/gesture-runtime',
        plugins: [
          ...(config.plugins || []),
          pluginReactLynx(),
        ],
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            vitest: require.resolve('./vitest-polyfill.cjs'),
          },
        },
        setupFiles: [
          ...(Array.isArray(config.setupFiles)
            ? config.setupFiles
            : config.setupFiles
            ? [config.setupFiles]
            : []),
          '__test__/utils/setup.ts',
        ],
        include: ['__test__/**/*.test.{js,jsx,ts,tsx}'],
        exclude: ['__test__/utils/**'],
      };
    },
  }),
});
