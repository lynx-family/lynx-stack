import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  entry: './index.js',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [CssExtractWebpackPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new CssExtractWebpackPlugin({
      filename: '[name].css',
    }),
  ],
};
