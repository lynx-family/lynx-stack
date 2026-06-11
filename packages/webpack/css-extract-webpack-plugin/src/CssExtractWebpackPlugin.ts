// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module';

import type { Compiler } from '@rspack/core';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const require = createRequire(import.meta.url);

/**
 * The options for CssExtractWebpackPlugin
 *
 * @public
 */
interface CssExtractWebpackPluginOptions
  extends MiniCssExtractPlugin.PluginOptions
{}

/**
 * @public
 *
 * CssExtractWebpackPlugin is the CSS extract plugin for Lynx.
 * It works just like the {@link https://github.com/webpack-contrib/mini-css-extract-plugin | MiniCssExtractPlugin} in Web.
 *
 * @example
 * ```js
 * import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'
 * export default {
 *   plugins: [new CssExtractWebpackPlugin()],
 *   module: {
 *     rules: [
 *       {
 *         test: /\.css$/,
 *         uses: [CssExtractWebpackPlugin.loader, 'css-loader'],
 *       },
 *     ],
 *   },
 * }
 * ```
 */
class CssExtractWebpackPlugin {
  constructor(
    private readonly options?: CssExtractWebpackPluginOptions | undefined,
  ) {}

  /**
   * The loader to extract CSS.
   *
   * @remarks
   * It should be used with the {@link https://github.com/webpack-contrib/css-loader | 'css-loader'}.
   *
   * @example
   *
   * ```js
   * import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'
   * export default {
   *   plugins: [new CssExtractWebpackPlugin()],
   *   module: {
   *     rules: [
   *       {
   *         test: /\.css$/,
   *         uses: [CssExtractWebpackPlugin.loader, 'css-loader'],
   *       },
   *     ],
   *   },
   * }
   * ```
   *
   * @public
   */
  static loader: string = require.resolve('./loader.js');

  /**
   * `defaultOptions` is the default options that the {@link CssExtractWebpackPlugin} uses.
   *
   * @public
   */
  static defaultOptions: Readonly<Required<CssExtractWebpackPluginOptions>> =
    Object.freeze<
      Required<CssExtractWebpackPluginOptions>
    >({
      filename: '[name].css',
      chunkFilename: undefined,
      ignoreOrder: undefined,
      insert: undefined,
      attributes: undefined,
      linkType: undefined,
      runtime: undefined,
      experimentalUseImportModule: undefined,
    });

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new CssExtractWebpackPluginImpl(
      compiler,
      Object.assign(
        {},
        CssExtractWebpackPlugin.defaultOptions,
        this.options,
      ),
    );
  }
}

export { CssExtractWebpackPlugin };
export type { CssExtractWebpackPluginOptions };

class CssExtractWebpackPluginImpl {
  name = 'CssExtractWebpackPlugin';

  constructor(
    compiler: Compiler,
    public options: CssExtractWebpackPluginOptions,
  ) {
    new MiniCssExtractPlugin({
      filename: options.filename,
      chunkFilename: options.chunkFilename,
      ignoreOrder: options.ignoreOrder,
      insert: options.insert,
      attributes: options.attributes,
      linkType: options.linkType,
      runtime: options.runtime,
      experimentalUseImportModule: options.experimentalUseImportModule,
    }).apply(
      compiler as unknown as Parameters<MiniCssExtractPlugin['apply']>[0],
    );
  }
}
