// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2019' },
  ],
  output: {
    externals: [
      {
        'preact': '@lynx-js/react/internal',
        'preact/hooks': '@lynx-js/react',
      },
    ],
  },
  tools: {
    rspack: (config, { rspack }) => {
      config.plugins ??= [];
      config.plugins.push(
        new rspack.ProvidePlugin({
          self: [
            fileURLToPath(new URL('./src/self.ts', import.meta.url)),
            'prefreshSelf',
          ],
        }),
      );
    },
  },
});
