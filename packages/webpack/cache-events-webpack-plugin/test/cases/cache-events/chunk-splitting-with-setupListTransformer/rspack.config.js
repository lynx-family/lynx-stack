import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

import { LynxCacheEventsPlugin } from '../../../../src';

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
    new LynxCacheEventsPlugin({
      setupListTransformer: (setupList) => {
        setupList.push(
          `
{
  name: 'customCacheEvent',
  setup: () => {
    console.log('customCacheEvent setup');
    return () => {
      console.log('customCacheEvent teardown');
    }
  }
}
  `,
        );
        return setupList;
      },
    }),
  ],
};
