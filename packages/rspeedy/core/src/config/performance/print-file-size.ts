// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Performance.printFileSize}
 *
 * @public
 */
export interface PrintFileSize {
  /**
   * Whether to output the total size of all static assets.
   *
   * @example
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
   */
  total?: boolean

  /**
   * Whether to output the size of each static asset.
   *
   * @example
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
   */
  detail?: boolean

  /**
   * Whether to output the gzip-compressed size of each static asset.
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
   */
  compressed?: boolean

  /**
   * A filter function to determine which static assets to print.
   *
   * If returned false, the static asset will be excluded and not included in the total size or detailed size.
   *
   * @example
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
   */
  include?: ((asset: PrintFileSizeAsset) => boolean) | undefined

  /**
   * A filter function to determine which static assets to exclude. If both include and exclude are set, exclude will take precedence.
   *
   * Rsbuild defaults to excluding source map, license files, and .d.ts type files, as these files do not affect page load performance.
   *
   * @example
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
  exclude?: ((asset: PrintFileSizeAsset) => boolean) | undefined
}

/**
 * @public
 */
export interface PrintFileSizeAsset {
  /**
   * The name of the static asset.
   * @example 'index.html', 'static/js/index.[hash].js'
   */
  name: string
  /**
   * The size of the static asset in bytes.
   */
  size: number
}
