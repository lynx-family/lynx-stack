// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      id: 'dev',
      format: 'iife',
      syntax: 'es2019',
      source: {
        define: {
          __DEV__: 'true',
        },
        entry: {
          dev: './runtime/src/worklet-runtime/index.ts',
        },
      },
      output: {
        sourceMap: {
          js: 'inline-source-map',
        },
        distPath: {
          root: './runtime/worklet-runtime',
        },
      },
    },
    {
      id: 'main',
      format: 'iife',
      syntax: 'es2019',
      source: {
        define: {
          __DEV__: 'false',
        },
        entry: {
          main: './runtime/src/worklet-runtime/index.ts',
        },
      },
      output: {
        minify: true,
        distPath: {
          root: './runtime/worklet-runtime',
        },
      },
    },
  ],
});
