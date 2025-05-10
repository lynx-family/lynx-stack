import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'sync-lynx',
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
