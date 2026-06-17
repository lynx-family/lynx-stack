// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'tailwind-preset',
  testEnvironment: 'node',
  globals: true,
  include: ['src/**/*.{test,spec}.{js,ts}'],
  resolve: {
    // in order to make our test case work for both vitest and rstest, we
    // alias `vitest` to `@rstest/core`
    alias: {
      vitest: require.resolve('./vitest-polyfill.cjs'),
    },
  },
});

export default config;
