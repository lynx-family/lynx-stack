// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core';
import path from 'path';

const __filename = new URL('', import.meta.url).pathname;
const __dirname = path.dirname(__filename);

/**
 * The options for {@link pluginWebPlatform}.
 *
 * @public
 */
export interface PluginWebPlatformOptions {
  /**
   * Whether to polyfill the packages about Lynx Web Platform.
   *
   * If it is true, @lynx-js will be compiled and polyfills will be added.
   *
   * @default true
   */
  polyfill?: boolean;
  /**
   * The absolute path of the native-modules file.
   *
   * If you use it, you don't need to pass nativeModulesMap in the lynx-view tag, otherwise it will cause duplicate packaging.
   *
   * When enabled, nativeModules will be packaged directly into the worker chunk instead of being transferred through Blob.
   */
  nativeModulesPath?: string;
}

/**
 * Create a rsbuild plugin for Lynx Web Platform.
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin'
 * import { defineConfig } from '@rsbuild/core';
 *
 * export default defineConfig({
 *   plugins: [pluginWebPlatform({
 *     // replace with your actual native-modules file path
 *     nativeModulesPath: path.resolve(__dirname, './index.native-modules.ts'),
 *   })],
 * })
 * ```
 *
 * @public
 */
export function pluginWebPlatform(
  userOptions?: PluginWebPlatformOptions,
): RsbuildPlugin {
  return {
    name: 'lynx:web-platform',
    async setup(api) {
      const defaultPluginOptions = {
        polyfill: true,
      };
      const options = Object.assign({}, defaultPluginOptions, userOptions);

      if (
        options.nativeModulesPath !== undefined
        && !path.isAbsolute(options.nativeModulesPath)
      ) {
        throw new Error(
          'options.nativeModulesPath must be an absolute path.',
        );
      }

      api.modifyRsbuildConfig(config => {
        if (options.polyfill === true) {
          config.source = {
            ...config.source,
            include: [
              ...(config.source?.include ?? []),
              /node_modules[\\/]@lynx-js[\\/]/,
            ],
          };
          config.output = {
            ...config.output,
            polyfill: 'usage',
          };
        }
      });

      api.modifyRspackConfig(rspackConfig => {
        console.log(path.resolve(
          __dirname,
          './loaders/native-modules.js',
        ));
        rspackConfig.module = {
          ...rspackConfig.module,
          rules: [
            ...(rspackConfig.module?.rules ?? []),
            {
              test:
                /backgroundThread\/background-apis\/createNativeModules\.js$/,
              loader: path.resolve(
                __dirname,
                './loaders/native-modules.js',
              ),
              options: {
                nativeModulesPath: options.nativeModulesPath,
              },
            },
          ],
        };
      });
    },
  };
}
