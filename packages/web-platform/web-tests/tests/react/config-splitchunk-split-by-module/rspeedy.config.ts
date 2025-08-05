// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@lynx-js/rspeedy';
import { commonConfig } from '../commonConfig.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caseName = path.basename(__dirname);

const root = path.join(__dirname, '..', '..', '..', 'dist', caseName);
const commonConfigResult = commonConfig({ firstScreenSyncTiming: 'jsReady' });
commonConfigResult.output!.distPath = { root };
commonConfigResult.output!.assetPrefix += `/${caseName}`;
export default defineConfig({
  ...commonConfigResult,
  source: {
    entry: {
      [caseName]: path.join(__dirname, 'index.jsx'),
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-module',
      override: {
        // See: https://github.com/web-infra-dev/rspack/issues/9812
        filename: '[name].[contenthash:8].js',
      },
    },
  },
});
