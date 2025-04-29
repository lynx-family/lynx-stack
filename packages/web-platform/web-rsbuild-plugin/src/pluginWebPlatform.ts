// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core';
import path from 'path';

const __filename = new URL('', import.meta.url).pathname;
const __dirname = path.dirname(__filename);

interface WorkerLoaderOptions {
  /**
   * @default "no-fallback"
   */
  inline: 'fallback' | 'no-fallback' | undefined;
}

/**
 * The options for {@link pluginWebPlatform}.
 *
 * @public
 */
export interface PluginWebPlatformOptions {
  /**
   * Whether to polyfill the packages about Lynx Web Platform.
   *
   * If it is true, @lynx-js will be compiled and polyfills will be added
   *
   * @default true
   */
  polyfill?: boolean;
  /**
   * Web Worker processing methods, including inline, filename, chunkname, etc.
   *
   * For configuration capabilities, please refer to: https://github.com/rspack-contrib/worker-rspack-loader
   */
  worker?: WorkerLoaderOptions;
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
 *   plugins: [pluginWebPlatform()],
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
        worker: {
          inline: 'no-fallback',
        },
      };
      const options = Object.assign({}, defaultPluginOptions, userOptions);

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
            {
              test: /\.worker\.js$/,
              loader: path.resolve(
                __dirname,
                './loaders/worker-loader/index.js',
              ),
            },
            {
              test: /^bootWorkers\.(js|ts)$/,
              loader: path.resolve(
                __dirname,
                './loaders/replace-worker-import.js',
              ),
            },
          ],
        };
      });
    },
  };
}
