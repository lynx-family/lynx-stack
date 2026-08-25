// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fileURLToPath } from 'node:url';

import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      output: {
        autoExternal: false,
      },
      dts: {
        bundle: true,
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native'),
        ),
      },
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.md$/,
            resourceQuery: /raw/,
            type: 'asset/source',
          },
        ],
      },
    },
  },
});

export default config;
