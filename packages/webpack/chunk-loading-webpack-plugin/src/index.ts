// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * An Rspack plugin to generate chunk loading runtime for Lynx.
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
 * The ChunkLoadingWebpackPlugin enables chunk loading for Rspack in Lynx.
 * It only takes effect when `output.chunkLoading` is `'lynx'`.
 *
 * @example
 *
 * ```js
 * // rspack.config.js
 * import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'
 * export default {
 *   output: {
 *     chunkLoading: 'lynx',
 *     chunkFormat: 'commonjs',
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
      compiler as unknown as import('@rspack/core').Compiler,
      options,
    );
  }
}
