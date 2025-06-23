// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RsbuildPlugin } from '@rsbuild/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getNativeModulesPathRule = (nativeModulesPath: string) => ({
  test: /backgroundThread[\\/]background-apis[\\/]createNativeModules\.js$/,
  loader: path.resolve(
    __dirname,
    './loaders/native-modules.js',
  ),
  options: {
    nativeModulesPath,
  },
});

export const getNapiModulesPathRule = (napiModulesPath: string) => ({
  test: /backgroundThread[\\/]background-apis[\\/]createNapiLoader\.js$/,
  loader: path.resolve(
    __dirname,
    './loaders/napi-modules.js',
  ),
  options: {
    napiModulesPath,
  },
});

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
   * When enabled, nativeModules will be packaged directly into the worker chunk instead of being transferred through Blob.
   *
   * Warning: If you use this, you don't need to pass nativeModulesMap in the lynx-view tag, otherwise it will cause duplicate packaging.
   */
  nativeModulesPath?: string;
  /**
   * The absolute path of the napi-modules file, it is similar to nativeModulesPath.
   *
   * When enabled, napiModules will be packaged directly into the worker chunk instead of being transferred through Blob.
   *
   * Warning: If you use this, you don't need to pass napiModulesMap in the lynx-view tag, otherwise it will cause duplicate packaging.
   */
  napiModulesPath?: string;
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

      if (
        options.napiModulesPath !== undefined
        && !path.isAbsolute(options.napiModulesPath)
      ) {
        throw new Error(
          'options.napiModulesPath must be an absolute path.',
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
        rspackConfig.module = {
          ...rspackConfig.module,
          rules: [
            ...(rspackConfig.module?.rules ?? []),
            options.nativeModulesPath
            && getNativeModulesPathRule(options.nativeModulesPath),
            options.napiModulesPath
            && getNapiModulesPathRule(options.napiModulesPath),
          ],
        };
      });
    },
  };
}
