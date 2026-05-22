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
 * This plugin is auto-registered by `@lynx-js/rspeedy` as a default
 * plugin — consumers do not need to apply it explicitly.
 */

export { pluginLynxDebugMetadata } from './pluginLynxDebugMetadata.js'
