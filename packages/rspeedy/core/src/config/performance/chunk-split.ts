// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

/**
 * {@inheritdoc Performance.chunkSplit}
 *
 * @public
 */
export interface ChunkSplit {
  /**
   * The ChunkSplitting strategy.
   *
   * @remarks
   *
   * - `split-by-experience`(default): an empirical splitting strategy, automatically splits some commonly used npm packages into chunks of moderate size.
   *
   * - `split-by-module`: split by NPM package granularity, each NPM package corresponds to a chunk.
   *
   * - `split-by-size`: automatically split according to module size.
   *
   * - `all-in-one`: bundle all codes into one chunk.
   *
   * - `single-vendor`: bundle all NPM packages into a single chunk.
   *
   * - `custom`: custom chunk splitting strategy.
   *
   * @example
   *
   * - Use `all-in-one` to put all modules in one chunk.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'all-in-one',
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use `single-vendor` to put all third-party dependencies in one chunk. And source code in another chunk.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'single-vendor',
   *     },
   *   },
   * })
   * ```
   */
  strategy?:
    | 'all-in-one'
    | 'split-by-module'
    | 'split-by-experience'
    | 'single-vendor'
    | undefined

  /**
   * Custom Rspack chunk splitting config can be specified.
   *
   * @example
   *
   * - Split `@lynx-js/react` and `react-router` into chunk `lib-react`.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'split-by-experience',
   *       override: {
   *         cacheGroups: {
   *           react: {
   *             test: /node_modules[\\/](@lynx-js[\\/]react|react-router)[\\/]/,
   *             name: 'lib-react',
   *           },
   *         },
   *       },
   *     },
   *   },
   * })
   * ```
   */
  override?: Rspack.Configuration extends {
    optimization?: {
      splitChunks?: infer P
    } | undefined
  } ? P
    : never
}

/**
 * {@inheritdoc Performance.chunkSplit}
 *
 * @public
 */
export interface ChunkSplitBySize {
  /**
   * {@inheritdoc ChunkSplit.strategy}
   */
  strategy: 'split-by-size'

  /**
   * The minimum size of a chunk, unit in bytes. Defaults to `10000`.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'split-by-size',
   *       minSize: 20000,
   *     },
   *   },
   * })
   * ```
   */
  minSize?: number | undefined

  /**
   * The maximum size of a chunk, unit in bytes. Defaults to `Number.POSITIVE_INFINITY`.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'split-by-size',
   *       maxSize: 50000,
   *     },
   *   },
   * })
   * ```
   */
  maxSize?: number | undefined

  /**
   * {@inheritdoc ChunkSplit.override}
   */
  override?: Rspack.Configuration extends {
    optimization?: {
      splitChunks?: infer P
    } | undefined
  } ? P
    : never
}

/**
 * {@inheritdoc Performance.chunkSplit}
 *
 * @public
 */
export interface ChunkSplitCustom {
  /**
   * {@inheritdoc ChunkSplit.strategy}
   */
  strategy: 'custom'

  /**
   * {@inheritdoc ChunkSplit.override}
   *
   * @example
   *
   * - Split `@lynx-js/react` and `react-router` into chunk `lib-react`.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     chunkSplit: {
   *       strategy: 'custom',
   *       splitChunks: {
   *         cacheGroups: {
   *           react: {
   *             test: /node_modules[\\/](@lynx-js[\\/]react|react-router)[\\/]/,
   *             name: 'lib-react',
   *           },
   *         },
   *       },
   *     },
   *   },
   * })
   * ```
   */
  splitChunks?: Rspack.Configuration extends {
    optimization?: {
      splitChunks?: infer P
    } | undefined
  } ? P
    : never
}
