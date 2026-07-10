// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A single Rsbuild plugin that turns a plain Rsbuild project into a Lynx one,
 * so a Lynx app can be built with the Rsbuild CLI directly instead of the
 * Rspeedy CLI.
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { defineConfig } from '@rsbuild/core'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 *
 * import { pluginLynxPreset } from '@lynx-js/preset-rsbuild-plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginLynxPreset(), pluginReactLynx()],
 *   environments: { lynx: {} },
 * })
 * ```
 */

import type { RsbuildPlugins } from '@rsbuild/core'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import { applyDefaultRspeedyConfig } from './config/defaults.js'
import type { Config } from './config/index.js'
import { pluginLynxConfig } from './defaults.js'
import {
  pluginChunkLoading,
  pluginDev,
  pluginMinify,
  pluginOptimization,
  pluginOutput,
  pluginResolve,
  pluginRsdoctor,
  pluginSourcemap,
  pluginStatsJson,
  pluginSwc,
  pluginTarget,
} from './internal.js'
import { pluginLynxAPI } from './plugin-api.js'

/**
 * Compose all the plugins the Rspeedy CLI applies by default, plus the Lynx
 * config defaults, into a single plugin usable from `rsbuild.config.ts`.
 *
 * @param config - An optional Lynx {@link Config} (the same shape as
 * `lynx.config.ts`). A project migrating off the Rspeedy CLI can pass its
 * existing config here; its `source`, `output`, `resolve`, `dev`,
 * `performance`, `tools`, etc. are translated into the Rsbuild build.
 *
 * @public
 */
export function pluginLynxPreset(config: Config = {}): RsbuildPlugins {
  // Resolve once: fill the Lynx defaults (filename, sourceMap, cssModules, …)
  // so both the exposed config (read by DSL plugins like `pluginReactLynx` and
  // `pluginQRCode`) and the Rsbuild-config translation see the same values.
  const resolved = applyDefaultRspeedyConfig(config)

  return [
    pluginLynxAPI(resolved),
    pluginLynxConfig(resolved),

    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginDev(),
    pluginMinify(),
    pluginOptimization(),
    pluginOutput(),
    pluginResolve(),
    pluginRsdoctor(),
    pluginSourcemap(),
    pluginStatsJson(resolved),
    pluginSwc(),
    pluginTarget(),
    pluginCssMinimizer(),
  ]
}

// The Lynx-shaped config surface. Re-exported by `@lynx-js/rspeedy` so the
// `import { Config } from '@lynx-js/rspeedy'` used by DSL plugins keeps working.
export type { ExposedAPI } from './api.js'
export { mergeRspeedyConfig } from './config/mergeRspeedyConfig.js'
export type { Config } from './config/index.js'

// Dev
export type { Dev } from './config/dev/index.js'
export type { Client as DevClient } from './config/dev/client.js'

// Output
export type {
  CssModules,
  CssModuleLocalsConvention,
} from './config/output/css-modules.js'
export type { DistPath } from './config/output/dist-path.js'
export type {
  BundleFilename,
  BundleFilenameContext,
  Filename,
} from './config/output/filename.js'
export type { Minify } from './config/output/minify.js'
export type { SourceMap } from './config/output/source-map.js'
export type { Output } from './config/output/index.js'

// Performance
export type { ConsoleType, Performance } from './config/performance/index.js'
export type { BuildCache } from './config/performance/build-cache.js'
export type {
  ChunkSplit,
  ChunkSplitBySize,
  ChunkSplitCustom,
} from './config/performance/chunk-split.js'

// Resolve
export type { Resolve } from './config/resolve/index.js'

// Server
export type { Server } from './config/server/index.js'

// Source
export type { Source } from './config/source/index.js'
export type { Decorators } from './config/source/decorators.js'
export type { Entry, EntryDescription } from './config/source/entry.js'
export type { TransformImport } from './config/source/transformImport.js'

// Tools
export type {
  CssExtract,
  CssExtractRspackLoaderOptions,
  CssExtractRspackPluginOptions,
} from './config/tools/css-extract.js'
export type { CssLoader, CssLoaderModules } from './config/tools/css-loader.js'
export type {
  RsdoctorRspackPluginOptions,
  Tools,
} from './config/tools/index.js'
