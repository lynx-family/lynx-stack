import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  output: {
    chunkLoading: 'async-lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].rspack.bundle.cjs',
  },
  optimization: {
    chunkIds: 'named',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
  ],
};
