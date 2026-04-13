// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Tools.cssExtract}
 *
 * @public
 */
export interface CssExtract {
  /**
   * {@inheritdoc @lynx-js/css-extract-webpack-plugin#LoaderOptions}
   *
   * @defaultValue undefined
   */
  loaderOptions?: CssExtractRspackLoaderOptions | undefined

  /**
   * {@inheritdoc @lynx-js/css-extract-webpack-plugin#CssExtractRspackPluginOptions}
   *
   * @defaultValue undefined
   */
  pluginOptions?: CssExtractRspackPluginOptions | undefined
}

/**
 * {@inheritdoc @lynx-js/css-extract-webpack-plugin#LoaderOptions}
 *
 * @public
 */
export interface CssExtractRspackLoaderOptions {
  /**
   * The same as {@link https://github.com/webpack-contrib/mini-css-extract-plugin#esModule}.
   * By default, `@lynx-js/css-extract-webpack-plugin` generates JS modules that use the ES modules syntax.
   * There are some cases in which using ES modules is beneficial,
   * like in the case of module concatenation and tree shaking.
   *
   * @example
   * You can enable a CommonJS syntax using:
   *
   * ```js
   * import {CssExtractWebpackPlugin} from "@lynx-js/css-extract-webpack-plugin";
   * export default {
   *   plugins: [new CssExtractWebpackPlugin()],
   *   module: {
   *     rules: [
   *       {
   *         test: /\.css$/i,
   *         use: [
   *           {
   *             loader: CssExtractWebpackPlugin.loader,
   *             options: {
   *               esModule: false,
   *             },
   *           },
   *           "css-loader",
   *         ],
   *       },
   *     ],
   *   },
   * };
   * ```
   *
   * @public
   *
   * @defaultValue true
   */
  esModule?: boolean | undefined
}

/**
 * {@inheritdoc @lynx-js/css-extract-webpack-plugin#CssExtractRspackPluginOptions}
 *
 * @public
 */
export interface CssExtractRspackPluginOptions {
  /**
   * {@inheritdoc @lynx-js/css-extract-webpack-plugin#CssExtractRspackPluginOptions.ignoreOrder}
   *
   * @defaultValue undefined
   */
  ignoreOrder?: boolean | undefined

  /**
   * {@inheritdoc @lynx-js/css-extract-webpack-plugin#CssExtractRspackPluginOptions.pathinfo}
   *
   * @defaultValue undefined
   */
  pathinfo?: boolean | undefined
}
