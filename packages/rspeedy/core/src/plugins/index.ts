// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildInstance, RsbuildPlugin } from '@rsbuild/core'

import type { Config } from '../config/index.js'
import { debug, isDebug } from '../debug.js'

async function applyDebugPlugins(
  rsbuildInstance: RsbuildInstance,
  config: Config,
): Promise<void> {
  const debugPlugins = Object.freeze<Promise<RsbuildPlugin>[]>([
    import('./emitOnErrors.plugin.js').then(({ pluginEmitOnErrors }) =>
      pluginEmitOnErrors()
    ),
    import('./inspect.plugin.js').then(({ pluginInspect }) =>
      pluginInspect(config)
    ),
  ])

  rsbuildInstance.addPlugins(await Promise.all(debugPlugins))
}

export async function applyDefaultPlugins(
  rsbuildInstance: RsbuildInstance,
  config: Config,
): Promise<void> {
  const defaultPlugins = Object.freeze<Promise<RsbuildPlugin>[]>([
    import('./api.plugin.js').then(({ pluginAPI }) => pluginAPI(config)),

    import('./chunkLoading.plugin.js').then(({ pluginChunkLoading }) =>
      pluginChunkLoading()
    ),

    import('./dev.plugin.js').then(({ pluginDev }) =>
      pluginDev(config.dev, config.server)
    ),

    import('./minify.plugin.js').then(({ pluginMinify }) =>
      pluginMinify(config.output?.minify)
    ),

    import('./optimization.plugin.js').then(({ pluginOptimization }) =>
      pluginOptimization()
    ),

    import('./output.plugin.js').then(({ pluginOutput }) =>
      pluginOutput(config.output)
    ),

    import('./resolve.plugin.js').then(({ pluginResolve }) => pluginResolve()),

    import('./rsdoctor.plugin.js').then(({ pluginRsdoctor }) =>
      pluginRsdoctor(config.tools?.rsdoctor)
    ),

    import('./sourcemap.plugin.js').then(({ pluginSourcemap }) =>
      pluginSourcemap()
    ),

    import('./swc.plugin.js').then(({ pluginSwc }) => pluginSwc()),

    import('./target.plugin.js').then(({ pluginTarget }) => pluginTarget()),
  ])

  const promises: Promise<void>[] = [
    Promise.all(defaultPlugins).then(plugins => {
      rsbuildInstance.addPlugins(plugins)
    }),
  ]

  if (isDebug()) {
    debug('apply Rspeedy default debug plugins')
    promises.push(applyDebugPlugins(rsbuildInstance, config))
  }

  await Promise.all(promises)

  // If no `@rsbuild/plugin-css-minimizer` is applied, apply it
  const { pluginCssMinimizer, PLUGIN_CSS_MINIMIZER_NAME } = await import(
    '@rsbuild/plugin-css-minimizer'
  )
  if (!rsbuildInstance.isPluginExists(PLUGIN_CSS_MINIMIZER_NAME)) {
    rsbuildInstance.addPlugins([pluginCssMinimizer()])
  }
}
