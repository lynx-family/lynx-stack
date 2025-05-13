import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  output: {
    chunkLoading: 'sync-lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].webpack.bundle.cjs',
  },
  optimization: {
    chunkIds: 'named',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
  ],
};
