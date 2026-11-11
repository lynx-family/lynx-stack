// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * The Lynx build engine as an Rsbuild plugin. It builds a Lynx app with the
 * Rsbuild CLI directly, without the Rspeedy CLI.
 *
 * DSL plugins such as
 * {@link @lynx-js/react-rsbuild-plugin#pluginReactLynx | pluginReactLynx}
 * register the engine automatically when it is missing, so you only add
 * `pluginLynx` yourself to pass the options below. Rspeedy registers it for
 * you as well and forwards `output.filename` and `performance.profile` from
 * `lynx.config.ts`.
 *
 * @example
 *
 * Register the plugin next to a DSL plugin in `rsbuild.config.ts`. The
 * environment name (`lynx` below) becomes the `[platform]` placeholder of the
 * bundle filename, so the default output of this config is
 * `dist/main.lynx.bundle`.
 *
 * ```ts title="rsbuild.config.ts"
 * import { defineConfig } from '@rsbuild/core'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 * import { pluginLynx } from '@lynx-js/rsbuild-plugin'
 *
 * export default defineConfig({
 *   source: {
 *     entry: { main: './src/index.tsx' },
 *   },
 *   environments: {
 *     lynx: {},
 *   },
 *   plugins: [
 *     pluginLynx({
 *       performance: { profile: false },
 *     }),
 *     pluginReactLynx(),
 *   ],
 * })
 * ```
 *
 * Then use the Rsbuild CLI:
 *
 * ```bash
 * rsbuild dev
 * rsbuild build
 * ```
 *
 * @remarks
 *
 * To migrate from Rspeedy, replace `rspeedy dev` / `rspeedy build` with
 * `rsbuild dev` / `rsbuild build`, rename `lynx.config.ts` to
 * `rsbuild.config.ts` and import `defineConfig` from `@rsbuild/core`. The two
 * options Rspeedy used to forward to the engine are now passed to
 * `pluginLynx` directly:
 *
 * | `lynx.config.ts` (Rspeedy) | `pluginLynx()` (Rsbuild) |
 * | --- | --- |
 * | `output.filename` as a string | `output.filename.bundle` |
 * | `output.filename.bundle` | `output.filename.bundle` |
 * | `output.filename.template` (deprecated) | `output.filename.bundle` |
 * | `performance.profile` | `performance.profile` |
 *
 * Everything else in `output`, `source`, `dev` and `server` keeps the Rsbuild
 * shape and stays in `rsbuild.config.ts`. The engine applies Lynx-specific
 * defaults on top of the Rsbuild ones (bundle target, chunk loading, CSS
 * extraction, source maps) and only overrides a setting when another plugin
 * has not already set it.
 */
import type { RsbuildPlugin } from '@rsbuild/core'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import type { LynxPluginOptions } from './config.js'
import { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
import { pluginConfig } from './plugins/config.plugin.js'
import { pluginCssMinimizer } from './plugins/cssMinimizer.plugin.js'
import { pluginDev } from './plugins/dev.plugin.js'
import { pluginEnvironments } from './plugins/environments.plugin.js'
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
  return [
    {
      name: PLUGIN_LYNX_NAME,
      setup() {
        // A marker, so its presence can be detected. It has no behavior.
      },
    },
    pluginConfig(options),
    pluginEnvironments(),
    pluginLynxDebugMetadata(),
    pluginResolve(),
    pluginSwc(),
    pluginTarget(),
    pluginOutput(),
    pluginMinify(),
    pluginCssMinimizer(),
    pluginSourcemap(),
    pluginTemplate(),
    pluginChunkLoading(),
    pluginDev(),
    pluginOptimization(),
    pluginServer(),
  ]
}
