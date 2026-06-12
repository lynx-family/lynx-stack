import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

/** @type {import('@rspack/core').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.(jsx?|tsx)/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  jsx: true,
                },
              },
            },
          },
          {
            loader: ReactWebpackPlugin.loader,
            options: { enableRemoveCSSScope: false },
          },
        ],
      },
      {
        test: /\.ts/,
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
        ],
      }
    ],
  },
  plugins: [new ReactWebpackPlugin({ enableRemoveCSSScope: false })],
}
