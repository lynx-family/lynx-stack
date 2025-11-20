// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

export default defineConfig({
  plugins: [
    pluginPublint({ throwOn: 'suggestion' }),
  ],
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: {
          // Avoid bundling `zod` types.
          bundledPackages: [],
        },
      },
    },
    {
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      source: {
        entry: {
          main: './src/main.ts',
        },
      },
      autoExternal: {
        // Bundle @modelcontextprotocol/sdk in CLI.
        peerDependencies: false,
      },
    },
  ],
});
