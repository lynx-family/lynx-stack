// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The granular Lynx config sub-types, published under the
// `@lynx-js/preset-rsbuild-plugin/config` subpath. The main entry keeps only
// the surface most consumers need (`Config`, `ExposedAPI`, `mergeRspeedyConfig`,
// `defineConfig`); these leaf types (reachable via `Config['output']` etc.) live
// here so the top-level API stays small. `@lynx-js/rspeedy` re-exports them so
// `import { Output } from '@lynx-js/rspeedy'` keeps working.

// Dev
export type { Dev } from './config/dev/index.js'
export type { Client as DevClient } from './config/dev/client.js'

// Output
export type {
  CssModuleLocalsConvention,
  CssModules,
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
