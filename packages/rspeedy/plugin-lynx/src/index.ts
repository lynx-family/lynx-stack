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
import { pluginTemplate } from './plugins/template.plugin.js'

/**
 * The name of the plugin that marks `pluginLynx` as applied. Use it with
 * `api.isPluginExists` to tell whether the Lynx build engine is already there.
 *
 * @public
 */
export const PLUGIN_LYNX_NAME = 'lynx:rsbuild'

export type {
  BundleFilename,
  BundleFilenameContext,
  LynxConfig,
  LynxFilename,
  LynxMinify,
  LynxOutput,
  LynxPerformance,
  LynxPluginOptions,
} from './config.js'

// `rslib` and `rstest` drive the build themselves: an external bundle is
// assembled by `@lynx-js/lynx-bundle-rslib-config`, which emits its own
// `.lynx.bundle`, and a test run emits nothing. They read the config all the
// same, so it is applied for them, but the plugins below assemble a bundle of
// their own and would rewrite what those callers emit.
function onlyWhenTheEngineOwnsTheBuild(
  plugins: RsbuildPlugin[],
): RsbuildPlugin[] {
  return plugins.map(plugin => ({
    ...plugin,
    setup(api) {
      const { callerName } = api.context
      if (callerName === 'rslib' || callerName === 'rstest') {
        return
      }
      return plugin.setup(api)
    },
  }))
}

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
    // Exposes the template lifecycle hooks and emits nothing itself, so a
    // caller that assembles its own bundle can drive the same hooks and get
    // the plugins that tap them, `pluginLynxDebugMetadata` among them.
    pluginTemplate(),
    // Taps the hooks above, so it covers an external bundle as well.
    pluginLynxDebugMetadata(),
    // What a module resolves to is a property of the Lynx runtime, not of who
    // assembles the bundle, so an external bundle resolves the same way.
    pluginResolve(),
    // The ES baseline is what the Lynx runtime can parse, so an external
    // bundle is lowered to it the same way.
    pluginSwc(),
    pluginTarget(),
    // What the output may contain — no HTML, no license trailer, `var` in the
    // bundler runtime — follows from the Lynx runtime, not from the caller.
    pluginOutput(),
    // How far the output may be compressed is a property of the Lynx runtime
    // too: the module wrapper has to keep its IIFE and its return.
    pluginMinify(),
    ...onlyWhenTheEngineOwnsTheBuild([
      pluginChunkLoading(),
      pluginCssMinimizer(),
      pluginDev(),
      pluginOptimization(),
      pluginServer(),
      pluginSourcemap(),
    ]),
  ]
}
