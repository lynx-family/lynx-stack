/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { DefinePlugin } from 'webpack'
import { CssExtractWebpackPlugin } from '../../../../src'
import { getPlugins } from '../../../../test/plugins.js'
import path from 'node:path'

/** @type {import('webpack').Configuration} */
export default {
  output: {
    publicPath: 'http://localhost:3000/',
    pathinfo: false,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractWebpackPlugin.loader,
          },
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    ...getPlugins({
      lynxTemplatePluginOptions: {
        enableCSSSelector: true,
        enableRemoveCSSScope: true,
      }
    }),
    new DefinePlugin({
      HMR_RUNTIME_LEPUS: JSON.stringify(path.resolve(__dirname, "../../../../runtime/hotModuleReplacement.lepus.cjs"))
    }),
    new CssExtractWebpackPlugin(),
  ],
}
