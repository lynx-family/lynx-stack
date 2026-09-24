// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: true,
      },
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
      background: './src/background/index.ts',
      common: './src/common/index.ts',
      'main-thread': './src/main-thread/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
});
