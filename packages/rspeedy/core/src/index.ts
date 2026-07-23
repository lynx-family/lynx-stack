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
export type { ConfigParams } from './config/defineConfig.js'
export {
  loadConfig,
  type LoadConfigOptions,
  type LoadConfigResult,
} from './config/loadConfig.js'
export type { Config } from './config/index.js'
// The granular option types are defined next to the plugins that consume
// them in `@lynx-js/rsbuild-plugin`; re-exported here as public API since
// they spell the `lynx.config.ts` schema.
export type {
  BuildCache,
  BundleFilename,
  BundleFilenameContext,
  ChunkSplit,
  ChunkSplitBySize,
  ChunkSplitCustom,
  Client as DevClient,
  ConsoleType,
  CssExtract,
  CssExtractRspackLoaderOptions,
  CssExtractRspackPluginOptions,
  CssLoader,
  CssLoaderModules,
  CssModuleLocalsConvention,
  CssModules,
  Decorators,
  Dev,
  DistPath,
  Entry,
  EntryDescription,
  Filename,
  Minify,
  Output,
  Performance,
  Resolve,
  RsdoctorRspackPluginOptions,
  Server,
  Source,
  SourceMap,
  Tools,
  TransformImport,
} from '@lynx-js/rsbuild-plugin/internal'

// RsbuildPlugin
export type { RsbuildPlugin, RsbuildPluginAPI } from '@rsbuild/core'
// Rspack instance
export { rspack } from '@rsbuild/core'
// Rspack Types
export type { Rspack } from '@rsbuild/core'

// Version
export { version, rsbuildVersion, rspackVersion } from './version.js'
