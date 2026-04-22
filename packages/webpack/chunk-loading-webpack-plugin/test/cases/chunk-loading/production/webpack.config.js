import { ChunkLoadingWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  output: {
    chunkLoading: 'lynx',
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
