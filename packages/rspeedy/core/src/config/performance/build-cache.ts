// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Performance.buildCache}
 *
 * @beta
 */
export interface BuildCache {
  /**
   * Add additional cache digests, the previous build cache will be invalidated
   * when any value in the array changes.
   *
   * @defaultValue undefined
   *
   * @example
   *
   * Add `process.env.SOME_ENV` to the cache digest.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     buildCache: {
   *       cacheDigest: [process.env.SOME_ENV],
   *     },
   *   },
   * })
   * ```
   */
  cacheDigest?: Array<string | undefined> | undefined

  /**
   * The output directory of the cache files.
   *
   * @defaultValue 'node_modules/.cache'
   */
  cacheDirectory?: string | undefined

  /**
   * An array of files containing build dependencies.
   * Rspack will use the hash of each of these files to invalidate the persistent cache.
   *
   * @remarks
   *
   * Rspeedy will use the following configuration files as the default build dependencies:
   *
   * - `package.json`
   *
   * - `tsconfig.json` (or `source.tsconfigPath`)
   *
   * - `.env`, `.env.*`
   *
   * - `tailwindcss.config.*`
   *
   * When using Rspeedy CLI, it will also automatically add
   * `lynx.config.js` to the build dependencies.
   *
   * @example
   *
   * Add `postcss.config.js` to the build dependencies.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   performance: {
   *     buildCache: {
   *       buildDependencies: ['postcss.config.js'],
   *     },
   *   },
   * })
   * ```
   */
  buildDependencies?: string[] | undefined
}
