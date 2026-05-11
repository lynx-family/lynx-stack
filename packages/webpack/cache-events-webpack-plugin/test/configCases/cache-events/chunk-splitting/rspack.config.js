// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

import { LynxCacheEventsPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  output: {
    filename: '[name].js',
    chunkLoading: 'lynx',
  },
  optimization: {
    moduleIds: 'named',
    splitChunks: {
      chunks: () => true,
      cacheGroups: {
        'lib-common': {
          test: /lib-common/,
          priority: 0,
          name: 'lib-common',
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    new LynxCacheEventsPlugin(),
  ],
};
