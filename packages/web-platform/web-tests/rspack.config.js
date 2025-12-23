// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import rspack from '@rspack/core';
import { fileURLToPath } from 'node:url';
import { genHtml } from './server.js';
import {
  getNativeModulesPathRule,
  getNapiModulesPathRule,
} from '@lynx-js/web-platform-rsbuild-plugin';
import { createWebVirtualFilesMiddleware } from '@lynx-js/web-rsbuild-server-middleware';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCI = !!process.env.CI;
const port = process.env.PORT ?? 3080;

const main = createWebVirtualFilesMiddleware('/middleware');
/** @type {import('@rspack/cli').Configuration} */
const config = {
  cache: false,
  entry: {
    main: './shell-project/index.ts',
    'web-elements': './shell-project/web-elements.ts',
    'main-thread-test': './shell-project/mainthread-test.ts',
    'web-core': './shell-project/web-core.ts',
    'fp-only': './shell-project/fp-only.ts',
  },
  resolve: {
    fallback: {
      'module': false,
    },
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
      'process.env.ENABLE_MULTI_THREAD': JSON.stringify(
        process.env.ENABLE_MULTI_THREAD,
      ),
    }),
    new rspack.HtmlRspackPlugin({
      title: 'lynx-for-web-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'mobile-web-app-capable': 'yes',
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
      filename: 'ssr.html',
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
    new rspack.HtmlRspackPlugin({
      title: 'fp-only-test',
      meta: {
        viewport:
          'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no',
        'mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'screen-orientation': 'portrait',
        'format-detection': 'telephone=no',
        'x5-orientation': 'portrait',
      },
      chunks: ['fp-only'],
      scriptLoading: 'module',
      filename: 'fp-only.html',
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
    setupMiddlewares: (middlewares) => {
      middlewares.push({
        name: 'fp-only',
        path: '/fp-only',
        middleware: async (req, res, next) => {
          try {
            const html = await readFile(
              path.join(__dirname, 'www', 'fp-only.html'),
              'utf-8',
            );
            const casename = req.query.casename;
            if (!casename) {
              res.statusCode = 400;
              res.send('casename is required');
              next();
              return;
            }

            res.send(await genHtml(html, casename, 'fp-only'));
            next();
          } catch (e) {
            res.statusCode = 500;
            console.error(e);
            res.send(e.toString() + '\n' + e.stack?.toString());
            next();
          }
        },
      }, {
        name: 'ssr',
        path: '/ssr',
        middleware: async (req, res, next) => {
          try {
            const html = await readFile(
              path.join(__dirname, 'www', 'index.html'),
              'utf-8',
            );
            const casename = req.query.casename;
            if (!casename) {
              res.statusCode = 400;
              res.send('casename is required');
              next();
              return;
            }

            res.send(await genHtml(html, casename, 'main'));
            next();
          } catch (e) {
            res.statusCode = 500;
            console.error(e);
            res.send(e.toString() + '\n' + e.stack?.toString());
            next();
          }
        },
      });
      middlewares.push(main);
      return middlewares;
    },
    watchFiles: isCI
      ? []
      : ['./node_modules/@lynx-js/**/*.js'],
    static: [
      {
        directory: path.join(__dirname, 'resources'),
        publicPath: '/resources',
        watch: !isCI,
      },
      {
        directory: path.join(__dirname, 'tests', 'web-elements'),
        publicPath: '/web-element-tests',
        watch: !isCI,
      },
      {
        directory: path.join(__dirname, 'node_modules'),
        publicPath: '/node_modules',
        watch: false,
      },
      {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/dist',
        watch: !isCI,
      },
      {
        directory: path.join(__dirname, 'tests', 'common.css'),
        publicPath: '/common.css',
        watch: !isCI,
      },
    ],
    hot: false,
  },
  watch: false,
  watchOptions: {
    ignored: isCI ? /.*/ : undefined,
  },
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
      getNativeModulesPathRule(path.resolve(
        __dirname,
        './shell-project/index.native-modules.ts',
      )),
      getNapiModulesPathRule(path.resolve(
        __dirname,
        './shell-project/index.napi-modules.ts',
      )),
    ],
  },
  experiments: {
    futureDefaults: true,
  },
};

export default config;
