import {ReactWebpackPlugin} from '@lynx-js/react-webpack-plugin'
import {ReactRefreshRspackPlugin} from '../../../../lib/index.js'
import {TestEnvPlugin} from '../../../TestEnvPlugin.ts'
import { createRequire } from 'node:module'
import path from 'path'

const require = createRequire(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

/** @type {import('@rspack/core').Configuration} */
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
          path.dirname(require.resolve('@lynx-js/react/package.json')) + path.sep,
          path.resolve(__dirname, '../../../../runtime'),
          ReactRefreshRspackPlugin.loader,
        ],
        use: [ReactRefreshRspackPlugin.loader],
      },
      {
        test: /\.(jsx?|tsx?)$/,
        use: [
          {
            loader: 'builtin:swc-loader',
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
    new ReactRefreshRspackPlugin(),
  ],
}
