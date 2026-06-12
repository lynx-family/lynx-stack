/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { mockLynxEncodePlugin } from '../../../../test/plugins.js'
import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin'
import path from 'node:path'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'


/** @type {import('@rspack/core').Configuration} */
export default {
  entry: {
    entry: path.resolve(import.meta.dirname, './entry.js')
  },
  output: {
    publicPath: 'http://localhost:3001/',
    pathinfo: false,
    filename: '[name].js',
    chunkFilename: 'async/[name].js',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          CssExtractRspackPlugin.loader,
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    mockLynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
    new rspack.DefinePlugin({
      HMR_RUNTIME_LEPUS: JSON.stringify(
        path.resolve(
          import.meta.dirname,
          '../../../../runtime/hotModuleReplacement.lepus.cjs',
        ),
      ),
    }),
    new CssExtractRspackPlugin({
      filename: '[name].css',
      chunkFilename: 'async/[name].css',
    }),
  ],
}
