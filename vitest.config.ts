// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/*.d.ts',
        '**/vitest.config.ts',
        '**/rslib.config.ts',
        '**/dist/**',
        '.github/**',
        'examples/**',
        'packages/**/lib/**',
        'packages/**/test/**',

        'packages/react/transform/tests/__swc_snapshots__/**',
        'packages/rspeedy/create-rspeedy/template-*/**',

        '.lintstagedrc.mjs',
        'eslint.config.js',

        'packages/tools/canary-release/**',
        'packages/web-platform/**',
        'packages/webpack/test-tools/**',
      ],
    },

    env: {
      RSPACK_HOT_TEST: 'true',
      DEBUG: 'rspeedy',
      UPDATE_SNAPSHOT:
        process.argv.includes('-u') || process.argv.includes('--update')
          ? 'true'
          : 'false',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      NODE_ENV: 'test',
    },
  },
});
