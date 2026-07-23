// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'

/**
 * {@inheritdoc Output.minify}
 *
 * @public
 */
export interface Minify {
  /**
   * Whether enable the CSS minification.
   *
   * @defaultValue When `output.minify` is enabled and `css` is unset, this defaults to `true`.
   *
   * @remarks
   *
   * When building for production, {@link https://github.com/rspack-contrib/rsbuild-plugin-css-minimizer | @rsbuild/plugin-css-minimizer} is used to minify CSS assets for better transmission efficiency.
   *
   * @example
   *
   * - Disable the CSS minification.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     minify: {
   *       css: false,
   *     },
   *   },
   * })
   * ```
   */
  css?: boolean | undefined

  /**
   * Whether enable the JavaScript minification.
   *
   * @defaultValue When `output.minify` is enabled and `js` is unset, this defaults to `true`.
   *
   * @example
   *
   * - Disable the JavaScript minification.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     minify: {
   *       js: false,
   *     },
   *   },
   * })
   * ```
   */
  js?: boolean | undefined

  /**
   * {@link Minify.jsOptions} is used to configure SWC minification options.
   *
   * @defaultValue When JavaScript minification is enabled and `jsOptions` is unset, this defaults to `{}`.
   *
   * @remarks
   *
   * For detailed configurations, please refer to {@link https://rspack.rs/plugins/rspack/swc-js-minimizer-rspack-plugin | SwcJsMinimizerRspackPlugin}.
   *
   * @example
   *
   * - Disable the mangle feature.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     minify: {
   *       jsOptions: {
   *         minimizerOptions: {
   *           mangle: false,
   *         },
   *       },
   *     },
   *   },
   * })
   * ```
   */
  jsOptions?: Rspack.SwcJsMinimizerRspackPluginOptions | undefined

  /**
   * {@link Minify.mainThreadOptions} is used to override
   * {@link Minify.jsOptions} for main-thread bundles.
   *
   * @defaultValue undefined
   *
   * @remarks
   *
   * This option is deep-merged into {@link Minify.jsOptions}.
   * It is mainly used together with ReactLynx dual-thread outputs so that
   * main-thread and background-thread bundles can use different compress rules.
   *
   * @example
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     minify: {
   *       jsOptions: {
   *         minimizerOptions: {
   *           compress: {
   *             pure_funcs: ['console.log'],
   *           },
   *         },
   *       },
   *       mainThreadOptions: {
   *         minimizerOptions: {
   *           compress: {
   *             pure_funcs: ['NativeModules.call', 'lynx.getJSModule'],
   *           },
   *         },
   *       },
   *     },
   *   },
   * })
   * ```
   */
  mainThreadOptions?: Rspack.SwcJsMinimizerRspackPluginOptions | undefined

  /**
   * {@link Minify.backgroundOptions} is used to override
   * {@link Minify.jsOptions} for background-thread bundles.
   *
   * @defaultValue undefined
   *
   * @remarks
   *
   * This option is deep-merged into {@link Minify.jsOptions}.
   * It is mainly used together with ReactLynx dual-thread outputs so that
   * main-thread and background-thread bundles can use different compress rules.
   */
  backgroundOptions?: Rspack.SwcJsMinimizerRspackPluginOptions | undefined
}
