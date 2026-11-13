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
    output: { autoExternal: false },
  }],
  source: {
    entry: { 'store/schema': './src/store/schema.ts' },
    // Schema resolution must not depend on the host page or worker location.
    // cfworker otherwise reads a global location unavailable in Lynx's sandbox.
    define: { self: 'undefined' },
    tsconfigPath: './tsconfig.build.json',
  },
  tools: {
    rspack: (config, { rspack }) => {
      config.plugins ??= [];
      config.plugins.push(
        new rspack.ProvidePlugin({
          URL: [
            fileURLToPath(new URL('./src/store/schemaUrl.ts', import.meta.url)),
            'SchemaURL',
          ],
        }),
      );
    },
  },
  performance: {
    buildCache: {
      // Invalidate resolved dependency paths when pnpm applies a new patch.
      buildDependencies: [
        fileURLToPath(new URL('../../../pnpm-lock.yaml', import.meta.url)),
      ],
    },
  },
  output: {
    target: 'web',
    cleanDistPath: false,
    minify: false,
  },
});

export default config;
