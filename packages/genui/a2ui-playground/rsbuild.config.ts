// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/entry.tsx',
      render: './src/render.tsx',
    },
  },
  output: {
    assetPrefix: process.env.ASSET_PREFIX,
  },
  server: {
    host: '0.0.0.0',
    cors: {
      origin: '*',
    },
    publicDir: [
      {
        name: 'www',
        copyOnBuild: true,
        watch: true,
      },
    ],
  },
});
