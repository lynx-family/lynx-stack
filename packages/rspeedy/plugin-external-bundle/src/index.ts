// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin for loading external bundles using externals-loading-webpack-plugin.
 */

import type { RsbuildPlugin } from '@rsbuild/core'

import type { ExternalsLoadingPluginOptions } from '@lynx-js/externals-loading-webpack-plugin'
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin'

interface ExposedLayers {
  readonly BACKGROUND: string
  readonly MAIN_THREAD: string
}

/**
 * Options for the external-bundle-rsbuild-plugin.
 *
 * @public
 */
export type PluginExternalBundleOptions = Pick<
  ExternalsLoadingPluginOptions,
  'externals'
>

/**
 * Create a rsbuild plugin for loading external bundles.
 *
 * This plugin wraps the externals-loading-webpack-plugin and automatically
 * retrieves layer names from the react-rsbuild-plugin via api.useExposed.
 *
 * @example
 * ```ts
 * // lynx.config.ts
 * import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 *
 * export default {
 *   plugins: [
 *     pluginReactLynx(),
 *     pluginExternalBundle({
 *       externals: {
 *         lodash: {
 *           url: 'http://lodash.lynx.bundle',
 *           background: { sectionPath: 'background' },
 *           mainThread: { sectionPath: 'mainThread' },
 *         },
 *       },
 *     }),
 *   ],
 * }
 * ```
 *
 * @public
 */
export function pluginExternalBundle(
  options: PluginExternalBundleOptions,
): RsbuildPlugin {
  return {
    name: 'lynx:external-bundle',
    setup(api) {
      api.modifyRspackConfig((config) => {
        // Get layer names from react-rsbuild-plugin
        const LAYERS = api.useExposed<ExposedLayers>(
          Symbol.for('LAYERS'),
        )

        if (!LAYERS) {
          throw new Error(
            'external-bundle-rsbuild-plugin requires exposed `LAYERS`.',
          )
        }
        config.plugins = config.plugins || []
        config.plugins.push(
          new ExternalsLoadingPlugin({
            backgroundLayer: LAYERS.BACKGROUND,
            mainThreadLayer: LAYERS.MAIN_THREAD,
            externals: options.externals,
          }),
        )
        return config
      })
    },
  }
}
