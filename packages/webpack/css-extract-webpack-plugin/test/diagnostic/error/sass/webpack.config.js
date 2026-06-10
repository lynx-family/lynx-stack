import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'

/** @type {import('@rspack/core').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: CssExtractWebpackPlugin.loader,
            options: {
              esModule: true,
            },
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'sass-loader'
          }
        ],
      },
    ],
  },
  plugins: [
    new CssExtractWebpackPlugin({
      filename: 'rspack.bundle.css',
    }),
  ],
}
