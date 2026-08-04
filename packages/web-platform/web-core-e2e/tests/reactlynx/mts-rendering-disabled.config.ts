// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';

import { commonConfig } from './commonConfig.js';

const cases = await Array.fromAsync(glob(
  [
    path.join(import.meta.dirname, 'mts-rendering-disabled-*', 'index.jsx'),
  ],
));

const config: Config = mergeRspeedyConfig(
  commonConfig({ enableMTSRendering: false }),
  {
    source: {
      entry: Object.fromEntries(cases.map((entry) => {
        return [path.basename(path.dirname(entry)), {
          import: entry,
          publicPath: '/dist/',
        }];
      })),
    },
  },
);

export default config;
