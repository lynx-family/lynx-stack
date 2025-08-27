// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildConfig, RsbuildPlugins } from '@rsbuild/core'

import type { Dev } from './dev/index.js'
import type { Output } from './output/index.js'
import type { Performance } from './performance/index.js'
import type { Resolve } from './resolve/index.js'
import type { Server } from './server/index.js'
import type { Source } from './source/index.js'
import type { Tools } from './tools/index.js'

/**
 * The `Config` is the configuration that `rspeedy` uses.
 *
 * @public
 */
export interface Config {
  /**
   * The {@link Dev} option is used to control the behavior related with development. Including: HMR, DevServer, etc.
   */
  dev?: Dev | undefined

  /**
   * The {@link Config.environments} option is used to set the output environment.
   *
   * @remarks
   *
   * Normally you don't need this if you are not using Lynx for Web.
   *
   * @example
   *
   * - Using different entries for Lynx and Web.
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   environments: {
   *     lynx: {},
   *     web: {
   *       source: { entry: { web: './src/index.web.jsx' } },
   *     },
   *   },
   *   source: {
   *     entry: './src/index.jsx',
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Building Web-only outputs.
   *
   * ```ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   environments: {
   *     web: {
   *       source: { entry: { web: './src/index.web.jsx' } },
   *     },
   *   },
   * })
   * ```
   */
  environments?: RsbuildConfig['environments'] | undefined

  /**
   * Specify the build mode for Rsbuild and Rspack, as each mode has different default behavior and optimizations.
   *
   * @remarks
   *
   * The default value of mode depends on the `process.env.NODE_ENV` environment variable:
   *
   * - If `NODE_ENV` is production, the default value is production.
   *
   * - If `NODE_ENV` is development, the default value is development.
   *
   * - If `NODE_ENV` has any other value, the default value is none.
   *
   * - If you set the value of mode, the value of `NODE_ENV` will be ignored.
   *
   * When using Rspeedy's CLI:
   *
   * - `rspeedy dev` and `rspeedy preview` will set the default values of `NODE_ENV` and `mode` to `'development'`.
   *
   * - `rspeedy build` will set the default values of `NODE_ENV` and `mode` to `'production'`.
   *
   * @example
   *
   * If the value of `mode` is `'development'`:
   *
   * - Enable HMR and register the {@link https://rspack.dev/plugins/webpack/hot-module-replacement-plugin | HotModuleReplacementPlugin}.
   *
   * - Generate JavaScript source maps, but do not generate CSS source maps. See {@link Output.sourceMap} for details.
   *
   * - The `process.env.NODE_ENV` in the source code will be replaced with `'development'`.
   *
   * - The `import.meta.env.MODE` in the source code will be replaced with `'development'`.
   *
   * - The `import.meta.env.DEV` in the source code will be replaced with `true`.
   *
   * - The `import.meta.env.PROD` in the source code will be replaced with `false`.
   *
   * @example
   *
   * If the value of `mode` is `'production'`:
   *
   * - Enable JavaScript code minification and register the {@link https://rspack.dev/plugins/rspack/swc-js-minimizer-rspack-plugin | SwcJsMinimizerRspackPlugin}.
   *
   * - Generated JavaScript and CSS filenames will have hash suffixes, see {@link Output.filenameHash}.
   *
   * - Generated CSS Modules classnames will be shorter, see {@link CssModules.localIdentName}.
   *
   * - Do not generate JavaScript and CSS source maps, see {@link Output.sourceMap}.
   *
   * - The `process.env.NODE_ENV` in the source code will be replaced with `'production'`.
   *
   * - The `import.meta.env.MODE` in the source code will be replaced with `'production'`.
   *
   * - The `import.meta.env.DEV` in the source code will be replaced with `false`.
   *
   * - The `import.meta.env.PROD` in the source code will be replaced with `true`.
   */
  mode?: 'development' | 'production' | 'none' | undefined

  /**
   * The {@link Output} option is used to set how and where should the bundles and assets output.
   */
  output?: Output | undefined

  /**
   * The {@link Performance} option is used to optimize the build-time and runtime performance.
   */
  performance?: Performance | undefined

  /**
   * The {@link Resolve} option is used to control the resolution behavior of Rspack.
   */
  resolve?: Resolve | undefined

  /**
   * The {@link Server} option changes the behavior of dev-server.
   */
  server?: Server | undefined

  /**
   * The {@link Source} option changes the behavior of source files.
   */
  source?: Source | undefined

  /**
   * The {@link Tools} options changes the behavior of various building tools.
   */
  tools?: Tools | undefined

  // TODO(guide): write guide for writing a plugin.
  // TODO(guide): write guide for migrating from a lynx-speedy plugin.
  /**
   * The `plugins` option is used to customize the build process in a variety of ways.
   *
   * @remarks
   * Rspeedy use the plugin APIs from {@link https://rsbuild.dev/plugins/dev/index | Rsbuild}. See the corresponding document for developing a plugin.
   */
  plugins?: RsbuildPlugins | undefined
}
