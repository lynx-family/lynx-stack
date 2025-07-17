// Copyright 2025 The Lynx Authors. All rights reserved.
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
          dev: './src/index.ts',
        },
      },
      output: {
        sourceMap: {
          js: 'inline-source-map',
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
          main: './src/index.ts',
        },
      },
      output: {
        minify: true,
      },
    },
  ],
});
