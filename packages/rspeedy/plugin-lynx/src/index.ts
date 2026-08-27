// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import type { LynxPluginOptions } from './config.js'
import { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
import { pluginConfig } from './plugins/config.plugin.js'
import { pluginCssMinimizer } from './plugins/cssMinimizer.plugin.js'
import { pluginDev } from './plugins/dev.plugin.js'
import { pluginMinify } from './plugins/minify.plugin.js'
import { pluginOptimization } from './plugins/optimization.plugin.js'
import { pluginOutput } from './plugins/output.plugin.js'
import { pluginResolve } from './plugins/resolve.plugin.js'
import { pluginServer } from './plugins/server.plugin.js'
import { pluginSourcemap } from './plugins/sourcemap.plugin.js'
import { pluginSwc } from './plugins/swc.plugin.js'
import { pluginTarget } from './plugins/target.plugin.js'

/**
 * The name of the plugin that marks `pluginLynx` as applied. Use it with
 * `api.isPluginExists` to tell whether the Lynx build engine is already there.
 *
 * @public
 */
export const PLUGIN_LYNX_NAME = 'lynx:rsbuild'

export {
  getLynxConfig,
  LYNX_CONFIG,
  resolveBundleFilename,
  resolveLazyBundleFilename,
} from './config.js'
export type {
  BundleFilename,
  BundleFilenameContext,
  LynxConfig,
  LynxFilename,
  LynxMinify,
  LynxOutput,
  LynxPluginOptions,
} from './config.js'

/**
 * @public
 */
export function pluginLynx(
  options: LynxPluginOptions = {},
): RsbuildPlugin[] {
  return [
    {
      name: PLUGIN_LYNX_NAME,
      setup() {
        // A marker, so its presence can be detected. It has no behavior.
      },
    },
    pluginConfig(options),
    pluginChunkLoading(),
    pluginCssMinimizer(),
    pluginDev(),
    pluginLynxDebugMetadata(),
    pluginMinify(),
    pluginOptimization(),
    pluginOutput(),
    pluginResolve(),
    pluginServer(),
    pluginSourcemap(),
    pluginSwc(),
    pluginTarget(),
  ]
}
