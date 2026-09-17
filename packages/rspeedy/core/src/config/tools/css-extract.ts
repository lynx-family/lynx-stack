// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritDoc Tools.cssExtract}
 *
 * @public
 */
export interface CssExtract {
  /**
   * The options of the CSS extract loader.
   *
   * @defaultValue undefined
   */
  loaderOptions?: CssExtractRspackLoaderOptions | undefined

  /**
   * The options of the CSS extract plugin.
   *
   * @defaultValue undefined
   */
  pluginOptions?: CssExtractRspackPluginOptions | undefined
}

/**
 * The options of the CSS extract loader.
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
   * import {CssExtractRspackPlugin} from "@lynx-js/css-extract-webpack-plugin";
   * export default {
   *   plugins: [new CssExtractRspackPlugin()],
   *   module: {
   *     rules: [
   *       {
   *         test: /\.css$/i,
   *         use: [
   *           {
   *             loader: CssExtractRspackPlugin.loader,
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
 * The options of the CSS extract plugin.
 *
 * @public
 */
export interface CssExtractRspackPluginOptions {
  /**
   * Whether to ignore warnings about conflicting order of CSS modules.
   *
   * @defaultValue undefined
   */
  ignoreOrder?: boolean | undefined

  /**
   * Whether to include comments with the module path in the output CSS.
   *
   * @defaultValue undefined
   */
  pathinfo?: boolean | undefined
}
