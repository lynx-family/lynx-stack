// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';
import type { RslibConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [{
    format: 'esm',
    syntax: 'es2022',
    bundle: true,
    dts: {
      bundle: true,
      typescriptPath: fileURLToPath(import.meta.resolve('@typescript/native')),
    },
    output: {
      target: 'node',
      externals: ['@rsbuild/core', '@rsbuild/plugin-react', 'typescript'],
    },
  }],
  source: {
    entry: {
      index: './src/index.ts',
      'build-worker': './src/build-worker.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: { sourceMap: { js: 'source-map' } },
});

export default config;
