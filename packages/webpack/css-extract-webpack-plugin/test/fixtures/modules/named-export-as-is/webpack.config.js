import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractWebpackPlugin.loader,
            options: {
              esModule: true,
            },
          },
          {
            loader: 'css-loader',
            options: {
              esModule: true,
              modules: {
                namedExport: true,
                exportLocalsConvention: 'asIs',
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CssExtractWebpackPlugin({
      filename: 'webpack.bundle.css',
    }),
  ],
};
