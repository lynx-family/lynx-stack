// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';

import { commonConfig } from './commonConfig.js';

const port = process.env['PORT'] ?? 3080;

const config: Config = mergeRspeedyConfig(commonConfig(), {
  plugins: [
    pluginExternalBundle({
      externals: {
        'greeting-lib': {
          // Served by the e2e dev server from the package `resources/` dir
          // (rsbuild.config.ts `publicDir: [{ name: '.' }]`).
          url:
            `http://localhost:${port}/resources/external-bundle/greeting.lynx.bundle`,
          libraryName: 'Greeting',
          background: { sectionPath: 'greeting' },
          mainThread: { sectionPath: 'greeting__main-thread' },
          async: true,
        },
      },
    }),
  ],
  source: {
    entry: {
      'external-bundle': {
        import: path.join(import.meta.dirname, 'external-bundle', 'index.jsx'),
        publicPath: '/dist/',
      },
    },
  },
});

export default config;
