// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        tsgo: false,
      },
      bundle: false,
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
