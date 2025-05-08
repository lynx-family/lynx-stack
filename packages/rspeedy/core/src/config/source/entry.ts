// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The `EntryDescription` describes a entry. It is useful when the project has multiple entries with different configuration.
 *
 * @remarks
 * It is similar with the {@link https://www.rspack.dev/config/entry#entry-description-object | Entry Description Object} of Rspack.
 * But only a few properties that Lynx supports is allowed.
 *
 * @public
 */
export interface EntryDescription {
  // TODO(doc): describe multiple entry modules in a single entry.
  /**
   * The path to the entry module(s).
   *
   * @remarks
   *
   * If no value is provided, the default value `src/index.js` will be used.
   *
   * @defaultValue `'./src/index.js'`
   */
  import?: string | string[] | undefined

  // TODO(doc): inherit from `output.publicPath`.
  /**
   * This is an important option when using on-demand-loading or loading external resources like images, files, etc. If an incorrect value is specified you'll receive 404 errors while loading these resources.
   *
   * @see https://webpack.js.org/configuration/output/#outputpublicpath
   */
  publicPath?: string | undefined
}

// TODO(doc): document about multiple entry modules
/**
 * {@inheritdoc Source.entry}
 *
 * @example
 *
 * - Use a single entry:
 *
 * ```js
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   source: {
 *     entry: './src/pages/main/index.js',
 *   }
 * })
 * ```
 *
 * @example
 *
 * - Use a single entry with multiple entry modules:
 *
 * ```js
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   source: {
 *     entry: ['./src/prefetch.js', './src/pages/main/index.js'],
 *   }
 * })
 * ```
 *
 * @example
 *
 * - Use multiple entries(with multiple entry modules):
 *
 * ```js
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   source: {
 *     entry: {
 *       foo: './src/pages/foo/index.js',
 *       bar: ['./src/pages/bar/index.js', './src/post.js'], // multiple entry modules is allowed
 *     }
 *   }
 * })
 * ```
 *
 * @example
 *
 * - Use multiple entries with {@link EntryDescription}:
 *
 * ```js
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   source: {
 *     entry: {
 *       foo: './src/pages/foo/index.js',
 *       bar: {
 *         import: ['./src/prefetch.js', './src/pages/bar'],
 *       }
 *     }
 *   }
 * })
 * ```
 * @public
 */
export type Entry =
  | string
  | string[]
  | Record<string, string | string[] | EntryDescription>
