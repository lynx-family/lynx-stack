import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

import { LynxCacheEventsPlugin } from '../../../../lib/index.js';

// An async entry (it imports a `promise` external, so the entry module becomes an
// async module) WITHOUT chunk splitting. Unlike `not-splitting`, the cache-events
// runtime must still be injected: the plugin requires `RuntimeGlobals.startup` for
// such entries so their startup becomes a wrappable, Promise-returning function.
/** @type {import('@rspack/core').Configuration} */
export default {
  target: 'node',
  output: {
    filename: '[name].js',
    chunkLoading: 'lynx',
  },
  optimization: {
    moduleIds: 'named',
  },
  externalsType: 'promise',
  externals: {
    'async-ext': 'promise (Promise.resolve({ add: (a, b) => a + b }))',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    new LynxCacheEventsPlugin(),
  ],
};
