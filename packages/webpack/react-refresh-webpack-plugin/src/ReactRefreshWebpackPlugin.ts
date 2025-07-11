// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Compilation, Compiler } from 'webpack';

import { LAYERS } from '@lynx-js/react-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PLUGIN_NAME = 'ReactRefreshWebpackPlugin';

/**
 * The options for {@link ReactRefreshWebpackPlugin}.
 *
 * @public
 */
export interface ReactRefreshWebpackPluginOptions {
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
 * ReactRefreshWebpackPlugin allows using fast refresh in ReactLynx.
 *
 * @example
 * ```js
 * // webpack.config.js
 * import { ReactRefreshWebpackPlugin } from '@lynx-js/react-refresh-webpack-plugin'
 * export default {
 *   plugins: [new ReactRefreshWebpackPlugin()],
 * }
 * ```
 *
 * @public
 */
export class ReactRefreshWebpackPlugin {
  /**
   * @param options - The options for react refresh.
   */
  constructor(options: ReactRefreshWebpackPluginOptions | undefined = {}) {
    this.#options = options;
  }

  #options: ReactRefreshWebpackPluginOptions;

  /**
   * The loader for react refresh.
   *
   * @remarks
   * Please note that the runtime of react should be ignored. See the example below:
   *
   * @example
   * ```js
   * // webpack.config.js
   * import { ReactRefreshWebpackPlugin } from '@lynx-js/react-refresh-webpack-plugin'
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
   *           ReactRefreshWebpackPlugin.loader,
   *         ],
   *         use: [ReactRefreshWebpackPlugin.loader],
   *       },
   *     ],
   *   },
   *   plugins: [new ReactRefreshWebpackPlugin()],
   * }
   * ```
   */
  static loader: string = require.resolve('../loader.cjs');

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    if (!isDev) {
      return;
    }

    const {
      EntryPlugin,
      ProvidePlugin,
      RuntimeGlobals,
      RuntimeModule,
    } = compiler.webpack;

    const provide: Record<string, string> = {
      __prefresh_utils__: path.resolve(__dirname, '../runtime/refresh.cjs'),
    };

    if (this.#options.overlay) {
      provide['__prefresh_errors__'] = this.#options.overlay.module;
    }

    new ProvidePlugin(provide).apply(compiler);
    new EntryPlugin(
      compiler.context,
      '@lynx-js/react-refresh',
      // @ts-expect-error: `undefined` means use globalEntry
      { name: undefined },
    ).apply(compiler);

    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation: Compilation) => {
        if (compilation.compiler !== compiler) {
          // Not pass to child compiler
          return;
        }

        class RefreshRuntimeModule extends RuntimeModule {
          constructor() {
            super('refresh', RuntimeModule.STAGE_BASIC);
          }

          override generate() {
            return fs.readFileSync(
              path.resolve(__dirname, '../runtime/intercept.cjs'),
              'utf-8',
            )
              .replaceAll('$MAIN_THREAD_LAYER$', LAYERS.MAIN_THREAD)
              .replaceAll('$BACKGROUND_LAYER$', LAYERS.BACKGROUND);
          }
        }

        compilation.mainTemplate.hooks.localVars.tap(PLUGIN_NAME, source => {
          return `
            ${source}
            // noop fns to prevent runtime errors during initialization
            if (typeof globalThis !== "undefined") {
              globalThis.$RefreshReg$ = function () {};
              globalThis.$RefreshSig$ = function () {
                return function(type) {
                  return type;
                };
              };
            }
          `;
        });

        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          PLUGIN_NAME,
          (chunk, runtimeRequirements) => {
            runtimeRequirements.add(RuntimeGlobals.interceptModuleExecution);
            compilation.addRuntimeModule(chunk, new RefreshRuntimeModule());
          },
        );
      },
    );
  }
}
