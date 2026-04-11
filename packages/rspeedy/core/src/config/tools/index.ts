// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ToolsConfig } from '@rsbuild/core'
import type { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'

import type { CssExtract } from './css-extract.js'
import type { CssLoader } from './css-loader.js'

export type RsdoctorRspackPluginOptions = ConstructorParameters<
  typeof RsdoctorRspackPlugin<[]>
>[0]

/**
 * {@inheritdoc Config.tools}
 *
 * @public
 */
export interface Tools {
  /**
   * The {@link Tools.bundlerChain} changes the options of {@link https://www.rspack.dev | Rspack} using {@link https://github.com/rspack-contrib/rspack-chain | rspack-chain}.
   *
   * @defaultValue undefined
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     bundlerChain(chain) {
   *       chain.resolve.fullySpecified(true)
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://github.com/rspack-contrib/rspack-chain | rspack-chain} for details.
   */
  bundlerChain?: ToolsConfig['bundlerChain'] | undefined

  /**
   * The {@link CssLoader} controls the options of {@link https://github.com/webpack-contrib/css-loader | css-loader}.
   *
   * @defaultValue Uses defaults derived from `output.cssModules` and `output.sourceMap`, with `importLoaders` set to `1` for CSS files and `2` for Sass/Less files.
   *
   * @remarks
   *
   * The default option is as follow:
   *
   * ```js
   * const defaultOptions = {
   *   modules: {
   *     auto: true,
   *     namedExport: false,
   *     exportLocalsConvention: 'camelCase',
   *     localIdentName: output.cssModules.localIdentName,
   *   },
   *   sourceMap: output.sourceMap,
   *   // importLoaders is `1` when compiling css files, and is `2` when compiling sass/less files
   *   importLoaders: 1 || 2,
   * };
   * ```
   */
  cssLoader?: CssLoader | undefined

  /**
   * The {@link CssExtract} controls the options of {@link https://www.rspack.dev/plugins/rspack/css-extract-rspack-plugin | CssExtractRspackPlugin}
   *
   * @defaultValue undefined
   */
  cssExtract?: CssExtract | undefined

  /**
   * The {@link Tools.rsdoctor} controls the options of {@link https://rsdoctor.dev/ | Rsdoctor}.
   *
   * @defaultValue undefined
   *
   * @remarks
   * Setting `RSDOCTOR=true` enables Rsdoctor. When it is enabled, Rspeedy merges additional plugin defaults during config normalization.
   *
   * @example
   *
   * - Use the built-in Rsdoctor.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     rsdoctor: {
   *       disableClientServer: true,
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://rsdoctor.dev/config/options/options | Rsdoctor - Configuration} for details.
   */
  rsdoctor?: RsdoctorRspackPluginOptions | undefined

  /**
   * The {@link Tools.rspack} controls the options of {@link https://www.rspack.dev/ | Rspack}.
   *
   * @defaultValue undefined
   *
   * @example
   *
   * - Use object config
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     rspack: {
   *       resolve: {
   *         fullySpecified: true,
   *       },
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://www.rspack.dev/config/index | Rspack - Configuration} for details.
   *
   * @example
   *
   * - Use function with `env` utils
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     rspack(config, { env }) {
   *       if (env === 'development') {
   *         config.devtool = 'cheap-source-map'
   *       }
   *       return config
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://rsbuild.dev/config/tools/rspack#env | Rsbuild - tools.rspack} for details.
   *
   * @example
   *
   * - Use function with `mergeConfig` utils
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     rspack(config, { mergeConfig }) {
   *       return mergeConfig(config, {
   *         resolve: {
   *           fullySpecified: true,
   *         },
   *       })
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://rsbuild.dev/config/tools/rspack#mergeconfig | Rsbuild - tools.rspack} for details.
   *
   * @example
   *
   * - Use function with `appendPlugins` utils
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     rspack(config, { appendPlugins, rspack }) {
   *       appendPlugins(new rspack.BannerPlugin({ banner: 'Hello, World!' }))
   *       return config
   *     },
   *   },
   * })
   * ```
   *
   * See {@link https://rsbuild.dev/config/tools/rspack#appendplugins | Rsbuild - tools.rspack} for details.
   */
  rspack?: ToolsConfig['rspack'] | undefined

  /**
   * The {@link Tools.swc} controls the options of {@link https://rspack.dev/guide/features/builtin-swc-loader | builtin:swc-loader}.
   *
   * @defaultValue undefined
   */
  swc?: ToolsConfig['swc'] | undefined
}
