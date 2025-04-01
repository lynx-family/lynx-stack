// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Compilation, Compiler } from '@rspack/core';

import { LAYERS } from '@lynx-js/react-webpack-plugin';

type RuntimeModule = Parameters<
  Compilation['hooks']['runtimeModule']['call']
>[0];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(__filename);

const PLUGIN_NAME = 'ReactRefreshRspackPlugin';

/**
 * The options for {@link ReactRefreshRspackPlugin}.
 *
 * @public
 */
export interface ReactRefreshRspackPluginOptions {
  /**
   * Not ready for public now.
   *
   * @internal
   */
  overlay?: {
    /**
     * The overlay module.
     */
    module: string;
  };
}

/**
 * ReactRefreshRspackPlugin allows using fast refresh in ReactLynx.
 *
 * @example
 * ```js
 * // rspack.config.js
 * import { ReactRefreshRspackPlugin } from '@lynx-js/react-refresh-webpack-plugin'
 * export default {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.[jt]sx?$/,
 *         exclude: [
 *           /node_modules/,
 *           /@lynx-js/,
 *           /react-refresh/,
 *           /compiler-nodiff-runtime3/,
 *           ReactRefreshRspackPlugin.loader,
 *         ],
 *         use: [ReactRefreshRspackPlugin.loader],
 *       },
 *     ],
 *   },
 *   plugins: [new ReactRefreshRspackPlugin()],
 * }
 * ```
 *
 * @public
 */
export class ReactRefreshRspackPlugin {
  /**
   * @param options - The options for react refresh.
   */
  constructor(options: ReactRefreshRspackPluginOptions = {}) {
    this.#options = options;
  }

  #options: ReactRefreshRspackPluginOptions;

  /**
   * The loader for react refresh.
   *
   * @remarks
   * Please note that the runtime of react should be ignored. See the example below:
   *
   * @example
   * ```js
   * // rspack.config.js
   * import { ReactRefreshRspackPlugin } from '@lynx-js/react-refresh-webpack-plugin'
   * import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
   *
   * export default {
   *   module: {
   *     rules: [
   *       {
   *         issueLayer: ReactWebpackPlugin.LAYERS.BACKGROUND,
   *         test: /\.[jt]sx?$/,
   *         exclude: [
   *           /node_modules/,
   *           /@lynx-js\/react/,
   *           ReactRefreshRspackPlugin.loader,
   *         ],
   *         use: [ReactRefreshRspackPlugin.loader],
   *       },
   *     ],
   *   },
   *   plugins: [new ReactRefreshRspackPlugin()],
   * }
   * ```
   */
  static loader: string = require.resolve('../loader.cjs');

  /**
   * The entry point of a rspack plugin.
   * @param compiler - the rspack compiler
   */
  apply(compiler: Compiler): void {
    if (
      process.env['NODE_ENV'] === 'production'
      || compiler.options.mode === 'production'
    ) {
      return;
    }

    const { ProvidePlugin } = compiler.webpack;

    const provide: Record<string, string> = {
      __prefresh_utils__: path.resolve(__dirname, '../runtime/refresh.cjs'),
    };

    if (this.#options.overlay) {
      provide['__prefresh_errors__'] = this.#options.overlay.module;
    }

    new ProvidePlugin(provide).apply(compiler);

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.runtimeModule.tap(PLUGIN_NAME, (runtimeModule) => {
        if (runtimeModule.name === 'hot_module_replacement') {
          this.#appendInterceptRuntimeModule(runtimeModule);
        }
      });
    });
  }

  #appendInterceptRuntimeModule(
    runtimeModule: RuntimeModule,
  ) {
    runtimeModule.source!.source = Buffer.concat([
      Buffer.from(runtimeModule.source!.source as Buffer),

      Buffer.from(
        fs.readFileSync(
          path.resolve(__dirname, '../runtime/intercept.cjs'),
          'utf-8',
        )
          .replaceAll('$MAIN_THREAD_LAYER$', LAYERS.MAIN_THREAD)
          .replaceAll('$BACKGROUND_LAYER$', LAYERS.BACKGROUND),
      ),

      // TODO: merge this with the webpack plugin
      Buffer.from(`
// noop fns to prevent runtime errors during initialization
if (typeof globalThis !== "undefined") {
  globalThis.$RefreshReg$ = function () {};
  globalThis.$RefreshSig$ = function () {
    return function(type) {
      return type;
    };
  };
}`),
    ]);
  }
}
