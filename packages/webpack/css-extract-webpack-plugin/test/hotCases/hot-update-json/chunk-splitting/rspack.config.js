/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core'
import { mockLynxEncodePlugin, plugins } from '../../../../test/plugins.js'
import { CssExtractRspackPlugin } from '../../../../src/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('webpack').Configuration} */
export default {
  entry: {
    index: path.resolve(__dirname, './index.js'),
    main2: path.resolve(__dirname, './entry2.js'),
    main3: path.resolve(__dirname, './entry3.js'),
    main4: path.resolve(__dirname, './entry4.js'),
  },
  output: {
    publicPath: 'http://localhost:3000/',
    pathinfo: false,
    filename: '[name].js',
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
    splitChunks: {
      chunks: () => true,
      cacheGroups: {
        'lib-common': {
          test: /lib-common/,
          priority: 0,
          name: 'lib-common',
          enforce: true,
        },
      }
    }
  },
  experiments: {
    css: false,
  },
  plugins: [
    mockLynxEncodePlugin(),
    ...[
      'index',
      'main1',
      'main2',
      'main3',
      'main4',
    ].map((chunk) => new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: [chunk],
      filename: `${chunk}/template.js`,
      intermediate: `.rspeedy/${chunk}`,
    })),
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
