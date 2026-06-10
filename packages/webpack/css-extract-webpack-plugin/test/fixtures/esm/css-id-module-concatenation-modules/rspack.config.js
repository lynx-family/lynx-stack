import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  optimization: {
    concatenateModules: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
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
                localIdentName: 'foo__[local]',
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CssExtractRspackPlugin({
      filename: 'rspack.bundle.css',
    }),
  ],
};
