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
// The Lynx build engine (plugins, config types, `ExposedAPI`, `mergeRspeedyConfig`)
// now lives in `@lynx-js/rsbuild-plugin`; re-exported here so the
// `@lynx-js/rspeedy` public API is unchanged for existing consumers.
export type { ExposedAPI } from '@lynx-js/rsbuild-plugin'
export {
  createRspeedy,
  type RspeedyInstance,
  type CreateRspeedyOptions,
} from './create-rspeedy.js'
export { logger } from '@rsbuild/core'
export { mergeRspeedyConfig } from '@lynx-js/rsbuild-plugin'

// Config
export { defineConfig } from './config/defineConfig.js'
export type { ConfigParams } from './config/defineConfig.js'
export {
  loadConfig,
  type LoadConfigOptions,
  type LoadConfigResult,
} from './config/loadConfig.js'
export type {
  BuildCache,
  BundleFilename,
  BundleFilenameContext,
  ChunkSplit,
  ChunkSplitBySize,
  ChunkSplitCustom,
  Config,
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
  DevClient,
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
} from '@lynx-js/rsbuild-plugin'

// RsbuildPlugin
export type { RsbuildPlugin, RsbuildPluginAPI } from '@rsbuild/core'
// Rspack instance
export { rspack } from '@rsbuild/core'
// Rspack Types
export type { Rspack } from '@rsbuild/core'

// Version
export { version, rsbuildVersion, rspackVersion } from './version.js'
