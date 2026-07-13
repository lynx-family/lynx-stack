// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Internal building blocks shared with the `@lynx-js/rspeedy` CLI, which
// composes them (threading the loaded `lynx.config.ts` into each plugin)
// instead of using the batteries-included `pluginLynxPreset`.
//
// This is NOT part of the public API of `@lynx-js/preset-rsbuild-plugin`.
//
// Keep these as plain `//` comments: a leading `/** @packageDocumentation */`
// JSDoc block makes tsc's declaration emitter drop the first `export` below.

// The Lynx build plugins as one shared composer (was 11 individual exports the
// CLI had to list in the same order — now a single source of truth).
export { composeLynxBuildPlugins } from './build-plugins.js'

export { debug, isDebug } from './debug.js'
export { isCI } from './utils/is-ci.js'
export { applyDefaultRspeedyConfig } from './config/defaults.js'
export { toRsbuildConfig } from './config/rsbuild/index.js'
export { DEFAULT_DIST_PATH_INTERMEDIATE } from './config/output/dist-path.js'
