// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';

import { commonConfig } from '../commonConfig.js';

const rpxTestCases = await Array.fromAsync(glob(
  [
    path.join(import.meta.dirname, '*.jsx'),
  ],
));

const config: Config = mergeRspeedyConfig(
  commonConfig({
    enableCSSSelector: true,
    enableRemoveCSSScope: false,
  }),
  {
    source: {
      entry: Object.fromEntries(rpxTestCases.map((testEntry) => {
        return [path.basename(testEntry, '.jsx'), testEntry];
      })),
    },
  },
);

export default config;
