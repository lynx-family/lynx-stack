// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';

import { commonConfig } from './commonConfig.js';

const config: Config = mergeRspeedyConfig(commonConfig(), {
  plugins: [
    pluginExternalBundle({
      externalsPresets: { reactlynx: { async: true } },
      globalObject: 'globalThis',
    }),
  ],
  source: {
    entry: {
      'async-external-env': {
        import: path.join(
          import.meta.dirname,
          'async-external-env',
          'index.jsx',
        ),
        publicPath: '/dist/',
      },
    },
  },
});

export default config;
