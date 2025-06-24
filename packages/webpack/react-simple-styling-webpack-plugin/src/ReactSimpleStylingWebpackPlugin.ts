// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import type { Compiler } from 'webpack';

const require = createRequire(import.meta.url);

/**
 * ReactSimpleStylingWebpackPlugin allows using simple styling in ReactLynx.
 *
 * @example
 * ```js
 * // webpack.config.js
 * import { ReactSimpleStylingWebpackPlugin } from '@lynx-js/react-simple-styling-webpack-plugin'
 * export default {
 *   plugins: [new ReactSimpleStylingWebpackPlugin()],
 * }
 * ```
 *
 * @public
 */
export class ReactSimpleStylingWebpackPlugin {
  /**
   * The loader for simple styling.
   *
   * @remarks
   * Please note that the runtime of react should be ignored. See the example below:
   *
   * @example
   * ```js
   * // webpack.config.js
   * import { ReactSimpleStylingWebpackPlugin } from '@lynx-js/react-simple-styling-webpack-plugin'
   * import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
   *
   * export default {
   *   module: {
   *     rules: [
   *       {
   *         test: /\.[jt]sx?$/,
   *         exclude: [
   *           /node_modules/,
   *           /@lynx-js\/react/,
   *           ReactSimpleStylingWebpackPlugin.loader,
   *         ],
   *         use: [ReactSimpleStylingWebpackPlugin.loader],
   *       },
   *     ],
   *   },
   *   plugins: [new ReactSimpleStylingWebpackPlugin()],
   * }
   * ```
   */
  static loader: string = require.resolve('../loader.js');

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(_compiler: Compiler): void {
    // do nothing currently
  }
}
