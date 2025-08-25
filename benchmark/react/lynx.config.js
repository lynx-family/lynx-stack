// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginRepoFilePath } from './plugins/pluginRepoFilePath.mjs';

export default defineConfig({
  output: {
    minify: {
      js: true,
      jsOptions: {
        minimizerOptions: {
          mangle: false,
        },
      },
    },
    assetPrefix: 'https://example.com/benchmark/react',
  },
  source: {
    entry: {
      '001-fib': [
        'event-target-polyfill',
        './src/dummyRoot.jsx',
        './cases/001-fib/index.ts',
      ],
      '002-hello-reactLynx': [
        'event-target-polyfill',
        './src/patchProfile.ts',
        './cases/002-hello-reactLynx/index.tsx',
      ],
    },
  },
  plugins: [
    pluginRepoFilePath(),
    pluginReactLynx({
      enableParallelElement: false,
      pipelineSchedulerConfig: 0,
      debugInfoOutside: false,
    }),
    pluginQRCode({}),
  ],
  performance: {
    profile: true,
  },
});
