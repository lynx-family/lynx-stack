// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';

import { commonConfig } from './commonConfig.js';

const reactBasicCases = await Array.fromAsync(glob(
  [
    path.join(import.meta.dirname, 'basic-*', 'index.jsx'),
  ],
));
const filteredCases = reactBasicCases.filter(filePath => {
  return !filePath.includes('basic-lazy-component-css-selector-false');
});

const config: Config = mergeRspeedyConfig(commonConfig(), {
  source: {
    entry: Object.fromEntries(filteredCases.map((reactBasicEntry) => {
      return [path.basename(path.dirname(reactBasicEntry)), {
        import: reactBasicEntry,
        publicPath: '/dist/',
      }];
    })),
  },
});

export default config;
