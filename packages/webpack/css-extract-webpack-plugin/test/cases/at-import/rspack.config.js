import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: './index.js',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [CssExtractRspackPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new CssExtractRspackPlugin({
      filename: '[name].css',
    }),
  ],
};
