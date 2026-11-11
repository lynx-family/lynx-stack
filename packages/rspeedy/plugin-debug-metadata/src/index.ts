// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * Rsbuild plugin that emits `debug-metadata.json` alongside each Lynx
 * bundle build, plus the underlying webpack plugin class for direct
 * webpack/rspack use.
 *
 * `pluginLynx` from `@lynx-js/rsbuild-plugin` registers this plugin, so apps
 * do not need to add it themselves.
 */

export { pluginLynxDebugMetadata } from './pluginLynxDebugMetadata.js'
export { DEBUG_METADATA_ASSET_NAME } from './constants.js'
export {
  type RewriteSourceMappingURLsOptions,
  rewriteSourceMappingURLs,
} from './LynxDebugMetadataPlugin.js'
