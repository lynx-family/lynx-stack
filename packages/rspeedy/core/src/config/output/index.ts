// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

import type { CssModules } from './css-modules.js'
import type { DistPath } from './dist-path.js'
import type { Filename } from './filename.js'
import type { Minify } from './minify.js'
import type { SourceMap } from './source-map.js'

/**
 * {@inheritdoc Config.output}
 * @public
 */
export interface Output {
  /**
   * The {@link Output.assetPrefix} is used to set the URL prefix for static assets.
   *
   * @remarks
   *
   * The functionality of {@link Output.assetPrefix} is basically the same as the {@link https://www.rspack.dev/config/output#outputpublicpath | output.publicPath}
   * config in Rspack. With the following differences:
   *
   * - `output.assetPrefix` only takes effect in the production build.
   *
   * - `output.assetPrefix` automatically appends a trailing `/` by default.
   *
   * - The value of `output.assetPrefix` is written to the `process.env.ASSET_PREFIX` environment variable.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     assetPrefix: 'https://cdn.example.com/assets/',
   *   },
   * })
   * ```
   */
  assetPrefix?: string | undefined

  /**
   * The {@link Output.cleanDistPath} option determines whether all files in the output directory (default: `dist`) are removed before the build starts.
   *
   * @remarks
   *
   * By default, if the output directory is a subdirectory of the project root path, Rspeedy will automatically clean all files in the build directory.
   *
   * When {@link https://rsbuild.dev/config/output/dist-path#root-directory | output.distPath.root} is an external directory or the same as the project root directory, `cleanDistPath` is not enabled by default to prevent accidental deletion of files from other directories.
   *
   * @example
   *
   * - Disable cleaning files:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     cleanDistPath: false,
   *   },
   * })
   * ```
   * @example
   *
   * - Only clean files before the production build:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     cleanDistPath: process.env.NODE_ENV === 'production',
   *   },
   * })
   * ```
   */
  cleanDistPath?: boolean | undefined

  /**
   * The {@link Output.copy} option is used for copying files to the dist directory.
   *
   * @remarks
   *
   * For more options, see {@link https://rspack.dev/plugins/rspack/copy-rspack-plugin | Rspack.CopyRspackPlugin}.
   *
   * @example
   *
   * - Copy files from `./src/assets` to the `./dist` directory:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     copy: [
   *       // `./src/assets/image.png` -> `./dist/image.png`
   *       { from: './src/assets' },
   *     ],
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Copy files from ./src/assets to the ./dist/assets directory:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     copy: [
   *       // `./src/assets/image.png` -> `./dist/assets/image.png`
   *       { from: './src/assets', to: 'assets' },
   *     ],
   *   },
   * })
   * ```
   */
  copy?:
    | Rspack.CopyRspackPluginOptions
    | Rspack.CopyRspackPluginOptions['patterns']
    | undefined

  /**
   * The {@link CssModules} option is used for the customization of CSS Modules configurations.
   *
   * @remarks
   *
   * The CSS module is enabled for `*.module.css`, `*.module.scss` and `*.module.less`.
   * Use {@link CssModules.auto} to customize the filtering behavior.
   *
   * @example
   *
   * Disable CSS modules:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     cssModules: {
   *       auto: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * Enable CSS modules for all CSS files:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     cssModules: {
   *       auto: () => true,
   *     },
   *   },
   * })
   * ```
   */
  cssModules?: CssModules | undefined

  /**
   * The {@link Output.dataUriLimit} option is used to set the size threshold to inline static assets such as images and fonts.
   *
   * @remarks
   *
   * The default value of `dataUriLimit` is 2kB.
   *
   * @example
   *
   * Inline all static assets less than 4kB:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     dataUriLimit: 4 * 1024,
   *   },
   * })
   * ```
   *
   * @example
   *
   * Disable inlining of static assets:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     dataUriLimit: 0,
   *   },
   * })
   * ```
   * @example
   *
   * Inline all static assets:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     dataUriLimit: Number.MAX_SAFE_INTEGER,
   *   },
   * })
   * ```
   */
  dataUriLimit?: number | undefined

  /**
   * Set the directory of the dist files.
   *
   * @remarks
   *
   * More options can be found at {@link https://rsbuild.dev/config/output/dist-path | Rsbuild - distPath}.
   *
   * @example
   *
   * Use `output` instead of `dist`(the default value):
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     distPath: {
   *       root: './output',
   *     },
   *   },
   * })
   * ```
   */
  distPath?: DistPath | undefined

  /**
   * The {@link Filename} determines the name of the JavaScript bundle file to be output. These bundles will be written to the directory specified by output.path.
   *
   * @remarks
   *
   * If a string is provided, it will be used as {@link Filename.bundle}.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     filename: '[name]/[name].lynx.bundle',
   *   },
   * })
   * ```
   */
  filename?: string | Filename | undefined

  /**
   * The {@link Output.filenameHash} option controls whether to add a hash value to the filename after the production build.
   *
   * @remarks
   *
   * {@link Output.filename} has a higher priority than {@link Output.filenameHash}.
   *
   * @example
   *
   * - Disable hash
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filenameHash: false,
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Change hash format
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   output: {
   *     filenameHash: 'fullhash:16',
   *   },
   * })
   * ```
   *
   * The available hash formats are:
   *
   * - `fullhash`: The hash value of the entire compilation. If any file changes, the hash values of all output files in the entire project will change.
   *
   * - `chunkhash`: The hash value of the chunk. The hash value will only change when the content of the chunk (and its included modules) changes.
   *
   * - `contenthash`: The hash value of the file content. The hash value will only change when the content of the file itself changes.
   */
  filenameHash?: boolean | string | undefined

  /**
   * The {@link Output.legalComments} controls how to handle the legal comment.
   *
   * @remarks
   *
   * If no value is provided, the default value would be `'none'`.
   *
   * This is different with Rsbuild since we normally do not want a `.LEGAL.txt` file in Lynx outputs.
   *
   * This behavior can be configured by using one of the following options:
   *
   * - `linked`: Extract all legal comments to a `.LEGAL.txt` file and link to them with a comment.
   *
   * - `inline`: Preserve all legal comments in original position.
   *
   * - `none`: Remove all legal comments.
   */
  legalComments?: 'none' | 'inline' | 'linked' | undefined

  /**
   * The {@link Minify} configures whether to enable code minification in the production build, or to configure minimizer options.
   *
   * @example
   *
   * Disable minification.
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   output: {
   *     minify: false,
   *   },
   * })
   * ```
   */
  minify?: Minify | boolean | undefined

  /**
   * The {@link SourceMap} configures whether and how to generate source-map for outputs.
   */
  sourceMap?: boolean | SourceMap | undefined
}
