// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginRepoFilePath } from './plugins/pluginRepoFilePath.mjs';
import { pluginScriptLoad } from './plugins/pluginScriptLoad.mjs';

export default defineConfig({
  output: {
    filenameHash: false,
    minify: {
      js: true,
      jsOptions: {
        minimizerOptions: {
          mangle: false,
          minify: false,
        },
      },
    },
    assetPrefix: 'https://example.com/benchmark/react',
  },
  source: {
    entry: {
      '001-fib': [
        'event-target-polyfill',
        './src/dummyRoot.tsx',
        './cases/001-fib/index.ts',
      ],
      '002-hello-reactLynx': [
        './src/patchProfile.ts',
        './cases/002-hello-reactLynx/index.tsx',
      ],
      '003-hello-list': [
        './src/patchProfile.ts',
        './src/patchUpdateListCallbacks.ts',
        './cases/003-hello-list/index.tsx',
      ],
      '004-various-update': [
        './cases/004-various-update/index.tsx',
      ],
      '005-load-script': [
        './cases/005-load-script/index.tsx',
      ],
    },
  },
  plugins: [
    pluginRepoFilePath(),
    pluginReactLynx({
      debugInfoOutside: false,
    }),
    pluginScriptLoad(),
    pluginQRCode({}),
  ],
  performance: {
    profile: true,
  },
});
