// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Internal building blocks shared with the `@lynx-js/rspeedy` CLI, which
// composes them (threading the loaded `lynx.config.ts` into each plugin)
// instead of using the batteries-included `pluginLynx`.
//
// This is NOT part of the public API of `@lynx-js/rsbuild-plugin`.
//
// Keep these as plain `//` comments: a leading `/** @packageDocumentation */`
// JSDoc block makes tsc's declaration emitter drop the first `export` below.

export { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
export { pluginDev } from './plugins/dev.plugin.js'
export { pluginMinify } from './plugins/minify.plugin.js'
export { pluginOptimization } from './plugins/optimization.plugin.js'
export { pluginOutput } from './plugins/output.plugin.js'
export { pluginResolve } from './plugins/resolve.plugin.js'
export { pluginRsdoctor } from './plugins/rsdoctor.plugin.js'
export { pluginSourcemap } from './plugins/sourcemap.plugin.js'
export { pluginStatsJson } from './plugins/statsJson.plugin.js'
export { pluginSwc } from './plugins/swc.plugin.js'
export { pluginTarget } from './plugins/target.plugin.js'

export { debug, debugList, isDebug } from './debug.js'
export { isCI } from './utils/is-ci.js'
export { DEFAULT_DIST_PATH_INTERMEDIATE } from './config/output/dist-path.js'

// The option types of the individual plugins above. The `Config` schema of
// `lynx.config.ts` is NOT defined here — `@lynx-js/rspeedy` composes it from
// these leaf types; `pluginLynx` itself takes no options.

// Dev
export type { Dev } from './config/dev/index.js'
export type { Client } from './config/dev/client.js'

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
