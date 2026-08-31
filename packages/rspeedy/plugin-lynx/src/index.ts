// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import type { LynxPluginOptions } from './config.js'
import { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
import { pluginConfig } from './plugins/config.plugin.js'
import { pluginCssMinimizer } from './plugins/cssMinimizer.plugin.js'
import { pluginDev } from './plugins/dev.plugin.js'
import { pluginMinify } from './plugins/minify.plugin.js'
import { pluginOptimization } from './plugins/optimization.plugin.js'
import { pluginOutput } from './plugins/output.plugin.js'
import { pluginResolve } from './plugins/resolve.plugin.js'
import { pluginServer } from './plugins/server.plugin.js'
import { pluginSourcemap } from './plugins/sourcemap.plugin.js'
import { pluginSwc } from './plugins/swc.plugin.js'
import { pluginTarget } from './plugins/target.plugin.js'
import { pluginTemplate } from './plugins/template.plugin.js'

/**
 * The name of the plugin that marks `pluginLynx` as applied. Use it with
 * `api.isPluginExists` to tell whether the Lynx build engine is already there.
 *
 * @public
 */
export const PLUGIN_LYNX_NAME = 'lynx:rsbuild'

export type {
  BundleFilename,
  BundleFilenameContext,
  LynxConfig,
  LynxFilename,
  LynxMinify,
  LynxOutput,
  LynxPerformance,
  LynxPluginOptions,
} from './config.js'

/**
 * Whether the Lynx build engine is already registered.
 *
 * @remarks
 *
 * The engine is a global one. `isPluginExists` without an environment only
 * reports the global plugins, so it misses an engine a caller — `rslib`, for
 * one — registered on an environment instead.
 *
 * @param host - The Rsbuild instance or plugin API to look it up on.
 * @param environments - The names of the configured environments.
 *
 * @public
 */
export function isPluginLynxRegistered(
  host: {
    isPluginExists(
      name: string,
      options?: { environment?: string },
    ): boolean
  },
  environments: string[],
): boolean {
  return host.isPluginExists(PLUGIN_LYNX_NAME)
    || environments.some(environment =>
      host.isPluginExists(PLUGIN_LYNX_NAME, { environment })
    )
}

/**
 * @public
 */
export function pluginLynx(
  options: LynxPluginOptions = {},
): RsbuildPlugin[] {
  // `rslib` assembles the bundle itself and `rstest` has none.
  const bundlePlugins = [
    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginOutput(),
    pluginSwc(),
    pluginCssMinimizer(),
    pluginDev(),
    pluginMinify(),
    pluginOptimization(),
    pluginServer(),
    pluginSourcemap(),
    pluginTarget(),
  ].map((plugin): RsbuildPlugin => ({
    ...plugin,
    setup(api) {
      const { callerName } = api.context
      if (callerName === 'rslib' || callerName === 'rstest') {
        return
      }
      return plugin.setup(api)
    },
  }))

  return [
    {
      name: PLUGIN_LYNX_NAME,
      setup() {
        // A marker, so its presence can be detected. It has no behavior.
      },
    },
    pluginConfig(options),
    pluginResolve(),
    pluginTemplate(),
    ...bundlePlugins,
  ]
}
