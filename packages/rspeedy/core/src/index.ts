// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * The document contains all the configurations of the `@lynx-js/rspeedy` package.
 *
 * @example
 *
 * Use `lynx.config.ts` with {@link defineConfig} to get better TypeScript intellisense.
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   entry: './src/index.tsx',
 * })
 * ```
 */

// API
export type { ExposedAPI } from './api.js'
export {
  createRspeedy,
  type RspeedyInstance,
  type CreateRspeedyOptions,
} from './create-rspeedy.js'
export { logger } from '@rsbuild/core'
export { mergeRspeedyConfig } from './config/mergeRspeedyConfig.js'

// Config
export { defineConfig } from './config/defineConfig.js'
export {
  loadConfig,
  type LoadConfigOptions,
  type LoadConfigResult,
} from './config/loadConfig.js'
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
export type { Filename } from './config/output/filename.js'
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

// RsbuildPlugin
export type { RsbuildPlugin, RsbuildPluginAPI } from '@rsbuild/core'
// Rspack instance
export { rspack } from '@rsbuild/core'
// Rspack Types
export type { Rspack } from '@rsbuild/core'

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

// Version
export { version, rsbuildVersion, rspackVersion } from './version.js'
