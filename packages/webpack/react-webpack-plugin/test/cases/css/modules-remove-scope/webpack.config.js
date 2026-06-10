import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin';

/** @type {import('@rspack/core').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.[tj]sx?$/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  jsx: false,
                },
              },
            },
          },
          {
            loader: ReactWebpackPlugin.loaders.MAIN_THREAD,
            options: {
              enableRemoveCSSScope: true,
            },
          },
        ],
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
              modules: {
                auto: true,
                namedExport: false,
              },
            },
          },
        ],
      },
    ],
  },
  experiments: {
    css: false,
  },
  plugins: [
    new CssExtractWebpackPlugin({
      filename: 'webpack.bundle.css',
    }),
    new ReactWebpackPlugin(),
    /**
     * @param {import('@rspack/core').Compiler} compiler
     */
    (compiler) => {
      new compiler.webpack.BannerPlugin({
        banner: `var globDynamicComponentEntry;`,
        raw: true,
        test: /\.js$/,
      }).apply(compiler);
    },
  ],
};
