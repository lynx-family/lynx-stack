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
const commonConfigResult = commonConfig();
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
      // Rspack 1.2.8 introduced a bug that causes the split-by-experience strategy to fail.
      // strategy: 'split-by-experience',
    },
  },
});
