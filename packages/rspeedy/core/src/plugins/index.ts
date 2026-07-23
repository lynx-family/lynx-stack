// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildInstance, RsbuildPlugin } from '@rsbuild/core'

import type { Config } from '@lynx-js/rsbuild-plugin'
import { debug, isDebug } from '@lynx-js/rsbuild-plugin/internal'

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
  // The default build plugins now live in `@lynx-js/rsbuild-plugin`.
  // The CLI composes them itself (threading the loaded `lynx.config.ts` into
  // each) rather than using the batteries-included `pluginLynx`.
  const defaultPlugins = Promise.all([
    import('./api.plugin.js'),
    import('@lynx-js/debug-metadata-rsbuild-plugin'),
    import('@lynx-js/rsbuild-plugin/internal'),
  ]).then(([{ pluginAPI }, { pluginLynxDebugMetadata }, {
    pluginChunkLoading,
    pluginDev,
    pluginMinify,
    pluginOptimization,
    pluginOutput,
    pluginResolve,
    pluginRsdoctor,
    pluginSourcemap,
    pluginStatsJson,
    pluginSwc,
    pluginTarget,
  }]) => [
    pluginAPI(config),
    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginDev(config.dev, config.server),
    pluginMinify(config.output?.minify),
    pluginOptimization(),
    pluginOutput(config.output),
    pluginResolve(),
    pluginRsdoctor(config.tools?.rsdoctor),
    pluginSourcemap(),
    pluginStatsJson(config),
    pluginSwc(),
    pluginTarget(),
  ])

  const promises: Promise<void>[] = [
    defaultPlugins.then(plugins => {
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
