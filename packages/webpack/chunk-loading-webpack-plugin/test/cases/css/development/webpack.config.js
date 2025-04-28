import MiniCssExtractPlugin from 'mini-css-extract-plugin';

import { ChunkLoadingWebpackPlugin } from '../../../../src/index';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  output: {
    chunkLoading: 'async-lynx',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].webpack.bundle.cjs',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
    compiler => {
      new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
      new MiniCssExtractPlugin({ chunkFilename: '[id].webpack.bundle.css' })
        .apply(
          compiler,
        );
    },
  ],
};
