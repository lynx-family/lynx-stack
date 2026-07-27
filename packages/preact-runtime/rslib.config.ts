// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';
import type { RslibConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    {
      id: 'background',
      format: 'esm',
      syntax: 'es2021',
      dts: true,
      source: {
        entry: {
          index: './src/index.ts',
          'compat/index': './src/compat/index.ts',
          'compat/debug': './src/compat/debug.ts',
        },
      },
      output: {
        externals: ['preact', 'preact/hooks', 'preact/compat'],
      },
    },
    {
      id: 'plugin',
      format: 'esm',
      syntax: 'es2022',
      // The webpack helper packages this imports are built by the root
      // `tsc --build`, which is not part of the turbo graph — skip dts.
      dts: false,
      source: {
        entry: {
          'plugin/index': './src/plugin/index.ts',
        },
      },
      output: {
        target: 'node',
      },
    },
    {
      id: 'main-thread',
      format: 'iife',
      syntax: 'es2019',
      source: {
        entry: {
          'main-thread': './src/main-thread/index.ts',
        },
      },
      output: {
        minify: false,
        sourceMap: {
          js: false,
        },
      },
    },
  ],
});

export default config;
