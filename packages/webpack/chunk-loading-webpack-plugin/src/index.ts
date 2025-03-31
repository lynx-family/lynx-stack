// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack/Rspack plugin to generate chunk loading runtime for Lynx.
 */

import type { Compiler } from '@rspack/core';

import { ChunkLoadingWebpackPluginImpl } from './ChunkLoadingWebpackPlugin.js';

/**
 * The options for ChunkLoadingWebpackPlugin
 *
 * @public
 */
// biome-ignore lint/suspicious/noEmptyInterface: As expected.
export interface ChunkLoadingWebpackPluginOptions {}

/**
 * The ChunkLoadingWebpackPlugin enables chunk loading for webpack/Rspack in Lynx.
 *
 * @example
 *
 * - Use with Rspack.
 *
 * ```js
 * // rspack.config.js
 * import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'
 * export default {
 *   output: {
 *     chunkFormat: 'require',
 *   },
 *   plugins: [new ChunkLoadingWebpackPlugin()],
 * }
 * ```
 *
 * @example
 *
 * - Use with Webpack.
 *
 * ```js
 * // webpack.config.js
 * import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'
 * export default {
 *   output: {
 *     chunkFormat: 'lynx',
 *   },
 *   plugins: [new ChunkLoadingWebpackPlugin()],
 * }
 * ```
 *
 * @public
 */
export class ChunkLoadingWebpackPlugin {
  constructor(
    private readonly options: Partial<ChunkLoadingWebpackPluginOptions> = {},
  ) {}

  /**
   * `defaultOptions` is the default options that the {@link ChunkLoadingWebpackPlugin} uses.
   *
   * @public
   */
  static defaultOptions = Object.freeze<
    Required<ChunkLoadingWebpackPluginOptions>
  >({});

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    const options = Object.assign(
      {},
      ChunkLoadingWebpackPlugin.defaultOptions,
      this.options,
    );
    new ChunkLoadingWebpackPluginImpl(
      compiler as unknown as import('webpack').Compiler,
      options,
    );
  }
}
