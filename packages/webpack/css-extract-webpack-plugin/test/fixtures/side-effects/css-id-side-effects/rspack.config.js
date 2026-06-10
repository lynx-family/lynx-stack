import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('@rspack/core').Configuration} */
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
            loader: CssExtractRspackPlugin.loader,
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
    new CssExtractRspackPlugin({
      filename: 'rspack.bundle.css',
    }),
  ],
};
