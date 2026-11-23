// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  lib: [
    {
      id: 'esm',
      format: 'esm',
      syntax: 'es2022',
      dts: {
        tsgo: false,
      },
      bundle: false,
    },
    {
      id: 'iife',
      format: 'iife',
      syntax: 'es2017',
      bundle: true,
      autoExtension: false,
      source: {
        entry: {
          mts: './src/mts.ts',
          bts: './src/bts.ts',
        },
      },
      output: {
        target: 'web',
        minify: true,
        distPath: {
          root: './dist/iife',
        },
      },
      tools: {
        rspack: {
          output: {
            library: {
              name: 'LynxRuntime',
              type: 'var',
            },
          },
        },
      },
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  plugins: [pluginPublint()],
  performance: {
    buildCache: false,
  },
});
