// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { PerformanceConfig } from '@rsbuild/core'

import type {
  ChunkSplit,
  ChunkSplitBySize,
  ChunkSplitCustom,
} from './chunk-split.js'

/**
 * The type of the console method.
 *
 * @public
 */
export type ConsoleType =
  | 'log'
  | 'warn'
  | 'error'
  | 'info'
  | 'debug'
  | 'profile'
  | 'profileEnd'
  // Allows creating a union type by combining primitive types and literal types without sacrificing auto-completion in IDEs for the literal type part of the union.
  // See: https://github.com/sindresorhus/type-fest/blob/81a05404c6c60583ff3dfcc0e4b992c62e052626/source/literal-union.d.ts
  | (string & Record<never, never>)

/**
 * {@inheritdoc Config.performance}
 *
 * @public
 */
export interface Performance {
  /**
   * {@link Performance.chunkSplit} is used to configure the chunk splitting strategy.
   */
  chunkSplit?: ChunkSplit | ChunkSplitBySize | ChunkSplitCustom | undefined

  /**
   * Whether to remove `console.[methodName]` in production build.
   *
   * @example
   *
   * - Remove all `console` methods
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     removeConsole: true,
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Remove specific `console` methods
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     removeConsole: ['log', 'warn']
   *   },
   * })
   * ```
   */
  removeConsole?: boolean | ConsoleType[] | undefined

  /**
   * Whether to print the file sizes after production build.
   *
   * {@link Performance.printFileSize}
   *
   * See {@link https://rsbuild.dev/config/performance/print-file-size | Rsbuild - performance.printFileSize} for details.
   *
   * @example
   *
   * If you don't want to print any information, you can disable it by setting printFileSize to false:
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: false
   *   },
   * })
   * ```
   *
   * @example
   *
   * Set total to false to disable total size output.
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: {
   *       total: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * Set detail to false to disable per-asset size output.
   *
   * If you don't need to view the size of each static asset, you can set detail to false. In this case, only the total size will be output:
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: {
   *       detail: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * If you don't need to view the gzipped size, you can set compressed to false. This can save some gzip computation time for large projects:
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: {
   *       compressed: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * To include only static assets that meet certain criteria, use a filter function with include.
   *
   * If returned false, the static asset will be excluded and not included in the total size or detailed size.
   *
   * only output static assets larger than 10kB:
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: {
   *       include: (asset) => asset.size > 10 * 1000,
   *     }
   *   },
   * })
   * ```
   *
   * @example
   *
   * To exclude static assets that meet certain criteria, use a filter function with exclude. If both include and exclude are set, exclude will take precedence.
   *
   * Rspeedy defaults to excluding source map, license files, and .d.ts type files, as these files do not affect page load performance.
   *
   * exclude .html files in addition to the default:
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     printFileSize: {
   *       exclude: (asset) =>
   *         /\.(?:map|LICENSE\.txt)$/.test(asset.name) ||
   *         /\.html$/.test(asset.name),
   *     }
   *   },
   * })
   * ```
   */
  printFileSize?: PerformanceConfig['printFileSize'] | undefined
}
