import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

import { LynxCacheEventsPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  output: {
    filename: '[name].js',
    chunkLoading: 'lynx',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    new LynxCacheEventsPlugin(),
  ],
};
