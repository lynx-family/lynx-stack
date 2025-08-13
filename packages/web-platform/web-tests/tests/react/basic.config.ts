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

const config: Config = mergeRspeedyConfig(commonConfig(), {
  source: {
    entry: Object.fromEntries(reactBasicCases.map((reactBasicEntry) => {
      return [path.basename(path.dirname(reactBasicEntry)), {
        import: reactBasicEntry,
        publicPath: '/dist/',
      }];
    })),
    define: {
      'process.env.PORT': JSON.stringify(process.env['PORT'] ?? 3080),
    },
  },
});

export default config;
