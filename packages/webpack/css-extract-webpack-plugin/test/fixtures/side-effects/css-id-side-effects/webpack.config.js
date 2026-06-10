import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('webpack').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.css$/,
        resourceQuery: /cssId/,
        sideEffects: false,
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractWebpackPlugin.loader,
          },
          {
            loader: 'css-loader',
            options: {
              esModule: true,
              modules: {
                namedExport: true,
                exportLocalsConvention: 'asIs',
                localIdentName: 'foo__[name]__[local]',
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
