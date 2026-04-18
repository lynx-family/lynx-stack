// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CssModuleLocalsConvention } from '../output/css-modules.js'

/**
 * {@inheritdoc Tools.cssLoader}
 *
 * @public
 */
export interface CssLoader {
  /**
   * The option `importLoaders` allows you to configure how many loaders before `css-loader` should be applied to `@imported` resources and CSS modules imports.
   *
   * @defaultValue `1` when compiling CSS files and `2` when compiling Sass or Less files
   *
   * @remarks
   *
   * See {@link https://github.com/webpack-contrib/css-loader?tab=readme-ov-file#importloaders | css-loader#import-loaders} for details.
   */
  importLoaders?: 0 | 1 | 2 | undefined

  /**
   * The {@link CssLoaderModules | cssLoader.modules} option enables/disables the CSS Modules specification and setup basic behavior.
   *
   * @defaultValue Enables CSS Modules with automatic `*.module.*` detection, camelCase exports, `namedExport: false`, and `localIdentName` inherited from `output.cssModules.localIdentName`.
   *
   * @example
   *
   * Using `false` value to increase performance because we avoid parsing CSS Modules features, it will be useful for developers who use vanilla css or use other technologies.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     cssLoader: {
   *       modules: false,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * Using `() => true` value to enable CSS Modules for all files.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     cssLoader: {
   *       modules: () => true,
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * Using object value to enable CSS Modules based-on {@link CssLoaderModules.auto} option and setup more configurations about CSS Modules.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   tools: {
   *     cssLoader: {
   *       modules: {
   *         namedExport: true,
   *       },
   *     },
   *   },
   * })
   * ```
   */
  modules?: boolean | CssLoaderModules | undefined
}

/**
 * {@inheritdoc CssLoader.modules}
 *
 * @public
 */
export interface CssLoaderModules {
  /**
   * {@inheritdoc CssModules.auto}
   *
   * @defaultValue true
   */
  auto?: boolean | RegExp | ((filename: string) => boolean) | undefined

  /**
   * {@inheritdoc CssModules.exportLocalsConvention}
   *
   * @defaultValue `'camelCase'`
   */
  exportLocalsConvention?: CssModuleLocalsConvention | undefined

  /**
   * {@inheritdoc CssModules.localIdentName}
   *
   * @defaultValue `'[local]-[hash:base64:6]'`
   */
  localIdentName?: string | undefined

  /**
   * Enables/disables ES modules named export for locals.
   *
   * @defaultValue false
   *
   * @example
   *
   * - `style.css`
   *
   * ```css
   * .foo-baz {
   *   color: red;
   * }
   * .bar {
   *   color: blue;
   * }
   * .default {
   *   color: green;
   * }
   * ```
   *
   * - `index.js`
   *
   * ```js
   * import * as styles from "./styles.css";
   *
   * // If using `exportLocalsConvention: "as-is"` (default value):
   * console.log(styles["foo-baz"], styles.bar);
   *
   * // If using `exportLocalsConvention: "camel-case-only"`:
   * console.log(styles.fooBaz, styles.bar);
   *
   * // For the `default` class name
   * console.log(styles["_default"]);
   * ```
   */
  namedExport?: boolean | undefined
}
