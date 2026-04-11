// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'

/**
 * {@inheritdoc Output.filename}
 *
 * @public
 */
export interface Filename {
  /**
   * The name of the bundle files.
   *
   * @defaultValue `'[name].[platform].bundle'`
   *
   * @remarks
   *
   * The following placeholder is supported:
   *
   * - `[name]`: the name of the entry.
   * - `[contenthash]`: the contenthash of the bundle.
   * - `[platform]`: the environment name of the bundle.
   *
   * @example
   *
   * - Using content hash in bundle filename:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       bundle: '[name].[contenthash].bundle',
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Using content hash with length in bundle filename:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       bundle: '[name].[contenthash:8].bundle',
   *     },
   *   },
   * })
   * ```
   */
  bundle?: string | undefined

  /**
   * The name of the template files.
   *
   * @deprecated
   *
   * Use {@link Filename.bundle} instead.
   *
   * @defaultValue `'[name].[platform].bundle'`
   *
   * @remarks
   *
   * The following placeholder is supported:
   *
   * - `[name]`: the name of the entry.
   * - `[contenthash]`: the contenthash of the template.
   *
   * @example
   *
   * - Using content hash in bundle filename:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       template: '[name].[contenthash].bundle',
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Using content hash with length in bundle filename:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       template: '[name].[contenthash:8].bundle',
   *     },
   *   },
   * })
   * ```
   */
  template?: string | undefined

  /**
   * The name of the JavaScript files.
   *
   * @defaultValue `'[name].js'` in development, `'[name].[contenthash:8].js'` in production web builds, and `'[name].js'` in production node builds
   *
   * @example
   *
   * - Using a function to dynamically set the filename based on the file information:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       js: (pathData, assetInfo) => {
   *         console.log(pathData); // You can check the contents of pathData here
   *
   *         if (pathData.chunk?.name === 'index') {
   *           return isProd ? '[name].[contenthash:8].js' : '[name].js';
   *         }
   *         return '/some-path/[name].js';
   *       },
   *     },
   *   },
   * })
   * ```
   */
  js?: Rspack.Filename | undefined

  /**
   * The name of the CSS files.
   *
   * @defaultValue `'[name]/[name].css'`
   *
   * @example
   *
   * - Using a function to dynamically set the filename based on the file information:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filename: {
   *       css: (pathData, assetInfo) => {
   *         console.log(pathData); // You can check the contents of pathData here
   *
   *         if (pathData.chunk?.name === 'index') {
   *           return isProd ? '[name].[contenthash:8].css' : '[name].css';
   *         }
   *         return '/some-path/[name].css';
   *       },
   *     },
   *   },
   * })
   * ```
   */
  css?: Rspack.CssFilename | undefined

  /**
   * The name of the SVG images.
   *
   * @defaultValue `'[name].[contenthash:8].svg'`
   */
  svg?: Rspack.AssetModuleFilename | undefined

  /**
   * The name of the font files.
   *
   * @defaultValue `'[name].[contenthash:8][ext]'`
   */
  font?: Rspack.AssetModuleFilename | undefined

  /**
   * The name of non-SVG images.
   *
   * @defaultValue `'[name].[contenthash:8][ext]'`
   */
  image?: Rspack.AssetModuleFilename | undefined

  /**
   * The name of media assets, such as video.
   *
   * @defaultValue `'[name].[contenthash:8][ext]'`
   */
  media?: Rspack.AssetModuleFilename | undefined

  /**
   * The name of WebAssembly files.
   *
   * @defaultValue `'[contenthash:8].module.wasm'`
   */
  wasm?: Rspack.WebassemblyModuleFilename

  /**
   * The name of other assets, except for above (image, svg, font, html, wasm...)
   *
   * @defaultValue `'[name].[contenthash:8][ext]'`
   */
  assets?: Rspack.AssetModuleFilename
}
