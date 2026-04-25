// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true, tsgo: true } },
  ],
  source: {
    entry: {
      index: './src/index.ts',
      cli: './src/cli.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
});

export default config;
