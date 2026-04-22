import { ChunkLoadingWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].webpack.bundle.cjs',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    compiler => {
      new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
    },
  ],
};
