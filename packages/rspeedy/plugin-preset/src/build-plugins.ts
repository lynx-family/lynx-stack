// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import type { Config } from './config/index.js'
import { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
import { pluginDev } from './plugins/dev.plugin.js'
import { pluginMinify } from './plugins/minify.plugin.js'
import { pluginOptimization } from './plugins/optimization.plugin.js'
import { pluginOutput } from './plugins/output.plugin.js'
import { pluginResolve } from './plugins/resolve.plugin.js'
import { pluginRsdoctor } from './plugins/rsdoctor.plugin.js'
import { pluginSourcemap } from './plugins/sourcemap.plugin.js'
import { pluginStatsJson } from './plugins/statsJson.plugin.js'
import { pluginSwc } from './plugins/swc.plugin.js'
import { pluginTarget } from './plugins/target.plugin.js'

/**
 * The Lynx build plugins (chunk loading, dev/HMR, swc, target, minify, …) with
 * the resolved config threaded into each — a single source of truth shared by
 * {@link pluginLynxPreset} and the Rspeedy CLI's `applyDefaultPlugins`.
 *
 * Excludes the API plugin (differs between the two callers), the config
 * translation, and `@rsbuild/plugin-css-minimizer` (the CLI adds it
 * conditionally). Callers compose those around this set.
 *
 * @param resolved - The Lynx config after `applyDefaultRspeedyConfig`.
 */
export function composeLynxBuildPlugins(resolved: Config): RsbuildPlugin[] {
  return [
    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginDev(resolved.dev, resolved.server),
    pluginMinify(resolved.output?.minify),
    pluginOptimization(),
    pluginOutput(resolved.output),
    pluginResolve(),
    pluginRsdoctor(resolved.tools?.rsdoctor),
    pluginSourcemap(),
    pluginStatsJson(resolved),
    pluginSwc(),
    pluginTarget(),
  ]
}
