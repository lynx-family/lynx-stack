// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@lynx-js/rspeedy';
import { commonConfig } from './commonConfig.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactBasicCases = await Array.fromAsync(glob(
  path.join(
    __dirname,
    'config-mixed-01',
    '*.jsx',
  ),
));

export default defineConfig({
  ...commonConfig({
    enableCSSSelector: false,
    enableRemoveCSSScope: false,
  }),
  source: {
    entry: Object.fromEntries(reactBasicCases.map((reactBasicEntry) => {
      return [path.basename(path.dirname(reactBasicEntry)), reactBasicEntry];
    })),
  },
});
