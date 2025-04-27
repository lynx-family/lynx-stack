// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { WatchFiles } from '@rsbuild/core'

import type { Client } from './client.js'

/**
 * {@inheritdoc Config.dev}
 * @public
 */
export interface Dev {
  /**
   * The {@link Dev.assetPrefix} is used to set the URL prefix for static assets during development.
   * @remarks
   *
   * The functionality of {@link Dev.assetPrefix} is basically the same as the {@link https://www.rspack.dev/config/output#outputpublicpath | output.publicPath}
   * config in Rspack. With the following differences:
   *
   * - `dev.assetPrefix` only takes effect during development.
   *
   * - `dev.assetPrefix` automatically appends a trailing `/` by default.
   *
   * - The value of `dev.assetPrefix` is written to the `process.env.ASSET_PREFIX` environment variable.
   *
   * @example
   *
   * If `dev.assetPrefix` is set to true, the URL prefix will be `http://<host>:<port>/`:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   dev: {
   *     assetPrefix: true,
   *   },
   * })
   * ```
   *
   * @example
   *
   * If `dev.assetPrefix` is set to a string, the value will be used as a prefix and automatically appended to the static resource URL.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   dev: {
   *     assetPrefix: 'https://example.com/assets/',
   *   },
   * })
   * ```
   *
   * @example
   *
   * The port number that Rspeedy server listens on may change. For example, if the port is in use, Rspeedy will automatically increment the port number until it finds an available port.
   *
   * To avoid `dev.assetPrefix` becoming invalid due to port changes, you can use one of the following methods:
   *
   * - Enable `server.strictPort`.
   *
   * - Use the `<port>` placeholder to refer to the current port number. Rspeedy will replace the placeholder with the actual port number it is listening on.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   dev: {
   *     assetPrefix: 'https://example.com:<port>/assets/',
   *   },
   * })
   * ```
   */
  assetPrefix?: string | boolean | undefined

  /**
   * Configuration of the development client.
   */
  client?: Client | undefined

  /**
   * Whether to enable Hot Module Replacement (HMR).
   *
   * @remarks
   *
   * Defaults to `true`.
   *
   * By default, Rspeedy uses HMR as the preferred method to update modules. If HMR is disabled or cannot be used in certain scenarios, it will automatically fallback to {@link Dev.liveReload}.
   *
   * To completely disable both HMR and live reload, set both `dev.hmr` and `dev.liveReload` to `false`. Then, no WebSocket requests will be made to the dev server on the page, and the page will not automatically refresh when file changes.
   *
   * @example
   *
   * Disable HMR:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     hmr: false,
   *   },
   * })
   * ```
   *
   * @example
   *
   * Disable both HMR and live reload:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     hmr: false,
   *     liveReload: false,
   *   },
   * })
   * ```
   */
  hmr?: boolean | undefined

  /**
   * Whether to enable live reload functionality.
   *
   * Defaults to `true`.
   *
   * Live reload is used as a fallback when {@link Dev.hmr} is disabled or cannot be used in certain scenarios. When enabled, the page will automatically refresh when source files are changed.
   *
   * To completely disable both HMR and live reload, set both `dev.hmr` and `dev.liveReload` to `false`. Then, no WebSocket requests will be made to the dev server on the page, and the page will not automatically refresh when file changes.
   *
   * @example
   *
   * Disable live reload:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     liveReload: false,
   *   },
   * })
   * ```
   *
   * @example
   *
   * Disable both HMR and live reload:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     hmr: false,
   *     liveReload: false,
   *   },
   * })
   * ```
   */
  liveReload?: boolean | undefined

  /**
   * Watch specified files and directories for changes. When a file change is detected, it can trigger a page reload or restart the dev server.
   *
   * @example
   *
   * - Specify the files and directories watched for changes.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     watchFiles: {
   *       paths: ['src/**', 'public/**'],
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use {@link https://github.com/paulmillr/chokidar#api | chokidar} options for watching.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     watchFiles: {
   *       paths: ['src/**', 'public/**'],
   *       options: { usePolling: false },
   *     },
   *   },
   * })
   * ```
   */
  watchFiles?: WatchFiles | WatchFiles[] | undefined

  /**
   * Used to control whether the build artifacts of the development environment are written to the disk.
   *
   * @remarks
   *
   * This is bypassed to {@link https://github.com/webpack/webpack-dev-middleware?tab=readme-ov-file#writetodisk | `webpack-dev-middleware`}.
   *
   * Setting `writeToDisk: true` won't change the behavior of the `webpack-dev-middleware`, and bundle files accessed through the browser will still be served from memory.
   *
   * This option also accepts a `Function` value, which can be used to filter which files are written to disk.
   *
   * The function follows the same premise as `Array#filter` in which a return value of `false` will not write the file, and a return value of `true` will write the file to disk.
   *
   * @example
   * ```js
   * // lynx.config.ts
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   dev: {
   *     writeToDisk: (filePath) => /superman\.css$/.test(filePath),
   *   },
   * })
   * ```
   */
  writeToDisk?: boolean | ((filename: string) => boolean) | undefined

  /**
   * Whether to display progress bar during compilation.
   *
   * Defaults to `true`.
   *
   * @example
   *
   * Disable the progress bar.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     progressBar: false,
   *   },
   * })
   * ```
   *
   * @example
   *
   * Modify the progress bar `id`
   *
   * To modify the text displayed on the left side of the progress bar, set the `id` option:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   dev: {
   *     progressBar: {
   *       id: 'Some Text'
   *     },
   *   },
   * })
   * ```
   */
  progressBar?: boolean | { id?: string } | undefined
}
