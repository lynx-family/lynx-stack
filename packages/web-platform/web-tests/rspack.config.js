// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import rspack from '@rspack/core';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCI = !!process.env.CI;
const port = process.env.PORT ?? 3080;
/** @type {import('@rspack/cli').Configuration} */
const config = {
  entry: {
    main: './shell-project/index.ts',
    'web-elements': './shell-project/web-elements.ts',
    'main-thread-test': './shell-project/mainthread-test.ts',
    'rpc-test': './shell-project/rpc-test/index.ts',
    'web-core': './shell-project/web-core.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'www'),
    devtoolModuleFilenameTemplate: (info) => {
      return info.absoluteResourcePath;
    },
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.ALL_ON_UI': JSON.stringify(process.env.ALL_ON_UI),
    }),
    new rspack.HtmlRspackPlugin({
      title: 'lynx-for-web-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'screen-orientation': 'portrait',
        'format-detection': 'telephone=no',
        'x5-orientation': 'portrait',
      },
      chunks: ['main'],
      scriptLoading: 'module',
      filename: 'index.html',
    }),
    new rspack.HtmlRspackPlugin({
      title: 'mainthread-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'screen-orientation': 'portrait',
        'format-detection': 'telephone=no',
        'x5-orientation': 'portrait',
      },
      chunks: ['main-thread-test'],
      scriptLoading: 'module',
      filename: 'main-thread-test.html',
    }),

    new rspack.HtmlRspackPlugin({
      title: 'rpc-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'screen-orientation': 'portrait',
        'format-detection': 'telephone=no',
        'x5-orientation': 'portrait',
      },
      chunks: ['rpc-test'],
      scriptLoading: 'module',
      filename: 'rpc-test.html',
    }),

    new rspack.HtmlRspackPlugin({
      title: 'lynx-for-web-core-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'screen-orientation': 'portrait',
        'format-detection': 'telephone=no',
        'x5-orientation': 'portrait',
      },
      chunks: ['web-core'],
      scriptLoading: 'module',
      filename: 'web-core.html',
    }),
  ],
  mode: 'development',
  devServer: {
    port,
    headers: {
      // enable cross-origin-isolate to enable SAB
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    devMiddleware: {
      writeToDisk: true,
    },
    watchFiles: ['./dist/**/*', './node_modules/@lynx-js/**/*'],
    static: [
      {
        directory: path.join(__dirname, 'resources'),
        publicPath: '/resources',
      },
      {
        directory: path.join(__dirname, 'tests', 'web-elements'),
        publicPath: '/web-element-tests',
      },
      {
        directory: path.join(__dirname, 'node_modules'),
        publicPath: '/node_modules',
      },
      {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/dist',
      },
      {
        directory: path.join(__dirname, 'tests', 'web-elements-plus'),
        publicPath: '/web-element-plus-tests',
      },
      {
        directory: path.join(__dirname, 'tests', 'common.css'),
        publicPath: '/common.css',
      },
    ],
    hot: false,
  },
  watch: false,
  module: {
    rules: [
      {
        test: /\.css$/,
        type: 'css',
      },
      {
        test: /\.tsx$|\.ts$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            sourceMap: true,
            jsc: {
              parser: {
                syntax: 'typescript',
                jsx: true,
              },
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
    ],
  },
  experiments: {
    css: true,
  },
};

export default config;
