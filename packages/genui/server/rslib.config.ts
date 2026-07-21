// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: true,
      autoExternal: false,
      dts: false,
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
      output: {
        target: 'node',
        externals: [/^@mastra\/core(?:\/.*)?$/u],
      },
    },
  ],
  output: {
    distPath: {
      root: './dist',
    },
    sourceMap: {
      js: 'source-map',
    },
  },
  source: {
    tsconfigPath: './tsconfig.json',
  },
  tools: {
    rspack: {
      watchOptions: {
        poll: 1_000,
        ignored: [
          '**/.git/**',
          '**/.turbo/**',
          '**/dist/**',
          '**/node_modules/**',
        ],
      },
    },
  },
});
