/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { CssExtractRspackPlugin } from '../../../../src/index'
import path from 'node:path'

/** @type {import('webpack').Configuration} */
export default {
  output: {
    publicPath: './',
    pathinfo: false,
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
            options: {
              modules: true,
            },
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
    new rspack.DefinePlugin({
      HMR_RUNTIME_LEPUS: JSON.stringify(
        path.resolve(
          __dirname,
          '../../../../runtime/hotModuleReplacement.lepus.cjs',
        ),
      ),
    }),
    new CssExtractRspackPlugin(),
  ],
}
