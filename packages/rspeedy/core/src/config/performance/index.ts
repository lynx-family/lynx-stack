// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ChunkSplit,
  ChunkSplitBySize,
  ChunkSplitCustom,
} from './chunk-split.js'
import type { PrintFileSize } from './print-file-size.js'

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
   */
  printFileSize?: boolean | PrintFileSize | undefined
}
