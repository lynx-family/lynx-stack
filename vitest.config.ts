// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import os from 'node:os';

import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**',
      '**/cypress/**',
      '**/lib/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    coverage: {
      exclude: [
        '**/*.d.ts',
        '**/*.test-d.*',
        '**/vitest.config.ts',
        '**/rslib.config.ts',
        '**/*.bench.js',
        '**/*.bench.ts',
        '**/dist/**',
        '.github/**',
        'examples/**',
        'packages/**/lib/**',
        'packages/**/test/**',
        'website/**',

        'packages/react/transform/tests/__swc_snapshots__/**',
        '**/tests/__swc_snapshots__/**',

        '.lintstagedrc.mjs',
        '**/eslint.config.js',

        'packages/tools/canary-release/**',
        'packages/web-platform/web-tests/**',
        'packages/web-platform/web-core-wasm-e2e/**',
        'packages/webpack/test-tools/**',
        'packages/testing-library/test-environment/**',
        'packages/react/testing-library/**',
        'packages/lynx/benchx_cli/**',
        'benchmark/react/**',
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

    maxWorkers: Math.max(
      1,
      ((cpuCount) =>
        Math.floor(
          cpuCount <= 32
            ? cpuCount / 2
            : 16 + (cpuCount - 32) / 6,
        ))(os.availableParallelism()),
    ),

    projects: [
      'examples/*/vitest.config.ts',
      'packages/react/*/vitest.config.ts',
      'packages/react/*/vitest.**.config.ts',
      'packages/rspeedy/*/vitest.config.ts',
      'packages/testing-library/*/vitest.config.mts',
      'packages/testing-library/examples/*/vitest.config.ts',
      '!packages/testing-library/examples/react-compiler/vitest.config.ts',
      'packages/testing-library/examples/react-compiler/vitest.config.*.ts',
      'packages/tailwind-preset/vitest.config.ts',
      'packages/tools/*/vitest.config.ts',
      'packages/use-sync-external-store/vitest.config.ts',
      'packages/web-platform/*/vitest.config.ts',
      'packages/webpack/*/vitest.config.ts',
      'packages/lynx/gesture-runtime/vitest.config.ts',
      'packages/motion/vitest.config.ts',
    ],
  },
});
