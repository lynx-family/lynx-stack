import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].rspack.bundle.cjs',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    compiler => {
      new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
    },
  ],
};
