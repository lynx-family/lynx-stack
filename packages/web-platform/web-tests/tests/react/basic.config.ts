// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Config } from '@lynx-js/rspeedy';
import { commonConfig } from './commonConfig.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactBasicCases = await Array.fromAsync(glob(
  path.join(__dirname, 'basic-*', 'index.jsx'),
));

const _default_1: Config = defineConfig({
  ...commonConfig(),
  source: {
    entry: Object.fromEntries(reactBasicCases.map((reactBasicEntry) => {
      return [path.basename(path.dirname(reactBasicEntry)), {
        import: reactBasicEntry,
        publicPath: '/dist/',
      }];
    })),
  },
});
export default _default_1;
