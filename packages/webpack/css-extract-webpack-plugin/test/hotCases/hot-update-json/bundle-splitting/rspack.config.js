/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { mockLynxEncodePlugin } from '../../../../test/plugins.js'
import { CssExtractRspackPlugin } from '../../../../src/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('webpack').Configuration} */
export default {
  entry: {
    entry: path.resolve(__dirname, './entry.js')
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
          __dirname,
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
