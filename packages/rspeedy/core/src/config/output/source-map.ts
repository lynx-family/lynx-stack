// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

/**
 * {@inheritdoc Output.sourceMap}
 *
 * @public
 */
export interface SourceMap {
  /**
   * How the source map should be generated. Setting it to `false` will disable the source map.
   *
   * @defaultValue When `output.sourceMap` is an object and `js` is unset, it defaults to `'cheap-module-source-map'` in development and `false` in production.
   *
   * @remarks
   *
   * See {@link https://rspack.rs/config/devtool | Rspack - Devtool} for details.
   *
   * @example
   *
   * - Enable high-quality source-maps for production:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     sourceMap: {
   *       js: process.env['NODE_ENV'] === 'production'
   *         ? 'source-map'
   *         : 'cheap-module-source-map',
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Disable source-map generation:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     sourceMap: {
   *       js: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use high-quality source-maps for all environments:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     sourceMap: {
   *       js: 'source-map',
   *     },
   *   },
   * })
   * ```
   */
  js?:
    | Rspack.DevTool
    | undefined
    | `${Exclude<Rspack.DevTool, false | 'eval'>}-debugids`
}
