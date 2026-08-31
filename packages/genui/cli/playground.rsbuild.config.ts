// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    define: {
      __A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__: 'false',
    },
    entry: {
      index: './src/playground/browser/control.tsx',
      preview: './src/playground/browser/preview.ts',
    },
    include: [/node_modules\/@lynx-js\//u, /@lynx-js\//u],
  },
  html: { template: './src/playground/browser/index.html' },
  output: {
    cleanDistPath: false,
    distPath: { root: 'dist/playground/public' },
    legalComments: 'none',
    sourceMap: { js: false, css: false },
  },
  performance: { chunkSplit: { strategy: 'all-in-one' } },
  tools: {
    htmlPlugin(config, { entryName }) {
      if (entryName === 'preview') {
        config.template = './src/playground/browser/preview.html';
      }
    },
    rspack: {
      module: {
        rules: [
          {
            test: /\.lynxml$/,
            resourceQuery: /raw/,
            type: 'asset/source',
          },
        ],
      },
    },
  },
});
