/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { CssExtractRspackPlugin } from '../../../../src'
import { getPlugins } from '../../../../test/plugins.js'
import path from 'node:path'

/** @type {import('webpack').Configuration} */
export default {
  output: {
    publicPath: 'http://localhost:3000/',
    pathinfo: false,
  },
  optimization: {
    moduleIds: 'named',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
          },
          'css-loader',
        ],
      },
    ],
  },
  experiments: {
    css: false,
  },
  plugins: [
    ...getPlugins({
      lynxTemplatePluginOptions: {
        enableCSSSelector: true,
        enableRemoveCSSScope: true,
      }
    }),
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
