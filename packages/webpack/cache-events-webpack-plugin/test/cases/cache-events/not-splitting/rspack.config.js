import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

import { LynxCacheEventsPlugin } from '../../../../src';

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
