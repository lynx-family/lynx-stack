import rspack from '@rspack/core';

import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'require',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].rspack.bundle.cjs',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          'css-loader',
        ],
      },
    ],
  },
  experiments: {
    css: false,
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    compiler => {
      new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
      new rspack.CssExtractRspackPlugin({
        chunkFilename: '[id].rspack.bundle.css',
      }).apply(compiler);
    },
  ],
};
