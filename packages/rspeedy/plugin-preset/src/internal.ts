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

export { debug, isDebug } from './debug.js'
export { isCI } from './utils/is-ci.js'
export { applyDefaultRspeedyConfig } from './config/defaults.js'
export { toRsbuildConfig } from './config/rsbuild/index.js'
export { DEFAULT_DIST_PATH_INTERMEDIATE } from './config/output/dist-path.js'
