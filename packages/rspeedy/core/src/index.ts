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
// now lives in `@lynx-js/preset-rsbuild-plugin`; re-exported here so the
// `@lynx-js/rspeedy` public API is unchanged for existing consumers.
export type { ExposedAPI } from '@lynx-js/preset-rsbuild-plugin'
export {
  createRspeedy,
  type RspeedyInstance,
  type CreateRspeedyOptions,
} from './create-rspeedy.js'
export { logger } from '@rsbuild/core'
export { mergeRspeedyConfig } from '@lynx-js/preset-rsbuild-plugin'

// Config
// `defineConfig` / `loadConfig` now live in `@lynx-js/preset-rsbuild-plugin`
// (which owns the config schema and its loader); re-exported here unchanged.
export { defineConfig, loadConfig } from '@lynx-js/preset-rsbuild-plugin'
export type {
  ConfigParams,
  LoadConfigOptions,
  LoadConfigResult,
} from '@lynx-js/preset-rsbuild-plugin'
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
} from '@lynx-js/preset-rsbuild-plugin'

// RsbuildPlugin
export type { RsbuildPlugin, RsbuildPluginAPI } from '@rsbuild/core'
// Rspack instance
export { rspack } from '@rsbuild/core'
// Rspack Types
export type { Rspack } from '@rsbuild/core'

// Version
export { version, rsbuildVersion, rspackVersion } from './version.js'
