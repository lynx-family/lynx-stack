import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  entry: ['./a.css', './b.css'],
  output: {
    pathinfo: false,
  },
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
