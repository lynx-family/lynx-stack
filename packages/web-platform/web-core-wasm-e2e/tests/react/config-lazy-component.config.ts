// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';
import { commonConfig } from './commonConfig.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactBasicCases = await Array.fromAsync(glob(
  path.join(
    __dirname,
    'config-lazy-component-*',
    '*.jsx',
  ),
));
const config: Config = mergeRspeedyConfig(
  commonConfig({
    experimental_isLazyBundle: true,
  }),
  {
    source: {
      entry: Object.fromEntries(reactBasicCases.map((reactBasicEntry) => {
        return [path.basename(path.dirname(reactBasicEntry)), reactBasicEntry];
      })),
    },
  },
);

export default config;
