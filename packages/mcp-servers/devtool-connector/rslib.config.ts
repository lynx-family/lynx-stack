// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  plugins: [
    pluginPublint({ throwOn: 'suggestion' }),
  ],
  source: {
    entry: {
      index: './src/index.ts',
      'transport/index': './src/transport/index.ts',
    },
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: false,
      },
    },
  ],
});
