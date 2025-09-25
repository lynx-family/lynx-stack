/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { CssExtractRspackPlugin } from '../../../../src'
import { plugins } from '../../../plugins.js'
import path from 'node:path'

/** @type {import('webpack').Configuration} */
export default {
  context: __dirname,
  entry: {
    'index': './index.js',
    'index__main-thread': './index-main-thread.js',
  },
  output: {
    filename: '[name].js',
    publicPath: 'http://localhost:3000/',
    pathinfo: false,
  },
  node: {
    __filename: true
  },
  module: {
    parser: {
      javascript: {
        importExportsPresence: false,
      },
    },
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
          },
          {
            loader: 'css-loader',
          },
        ],
      },
    ],
  },
  optimization: {
    moduleIds: 'named',
  },
  experiments: {
    css: false,
  },
  plugins: [
    ...plugins,
    new rspack.DefinePlugin({
      HMR_RUNTIME_LEPUS: JSON.stringify(
        path.resolve(
          __dirname,
          '../../../../runtime/hotModuleReplacement.lepus.cjs',
        ),
      ),
    }),
    new CssExtractRspackPlugin({ filename: '[name]/[name].css' }),
  ],
}
