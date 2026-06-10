import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

/** @type {import('webpack').Configuration} */
export default {
  module: {
    rules: [
      {
        test: /\.(jsx?|tsx?)/,
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
            loader: ReactWebpackPlugin.loaders.BACKGROUND,
            options: {
              compat: {}
            }
          },
        ],
      },
    ],
  },
  plugins: [new ReactWebpackPlugin()],
}
