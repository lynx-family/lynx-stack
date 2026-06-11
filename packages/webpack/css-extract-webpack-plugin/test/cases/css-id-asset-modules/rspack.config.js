import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  entry: './index.js',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
          },
          'css-loader',
        ],
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/[name][ext][query]',
        },
      },
    ],
  },
  plugins: [
    new CssExtractRspackPlugin({
      filename: '[name].css',
    }),
  ],
};
