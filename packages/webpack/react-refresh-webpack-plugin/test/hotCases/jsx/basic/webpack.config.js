import path from 'node:path'

import {ReactWebpackPlugin} from '@lynx-js/react-webpack-plugin'

import {ReactRefreshWebpackPlugin} from '../../../../src'
import {TestEnvPlugin} from "../../../TestEnvPlugin"

/** @type {import('webpack').Configuration} */
export default {
  context: __dirname,
  entry: './index.jsx',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: [
          /node_modules/,
          /@lynx-js/,
          /compiler-nodiff-runtime3/,
          /background-only/,
          path.dirname(require.resolve('@lynx-js/react/package.json')) + path.sep,
          path.resolve(__dirname, '../../../../runtime'),
          ReactRefreshWebpackPlugin.loader,
        ],
        use: [ReactRefreshWebpackPlugin.loader],
      },
      {
        test: /\.(jsx?|tsx?)$/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              jsc: {
                target: 'es2019',
                parser: {
                  syntax: 'typescript',
                  jsx: true,
                },
                transform: {
                  react: {
                    refresh: true,
                  },
                },
              },
            },
          },
          {
            loader: ReactWebpackPlugin.loaders.BACKGROUND,
            options: { enableRemoveCSSScope: true, refresh: true },
          },
        ],
      },
    ],
  },
  plugins: [
    new TestEnvPlugin(),
    new ReactRefreshWebpackPlugin(),
  ],
}
