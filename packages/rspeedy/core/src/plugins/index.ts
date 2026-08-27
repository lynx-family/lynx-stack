// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildInstance, RsbuildPlugin } from '@rsbuild/core'

import type { LynxPluginOptions } from '@lynx-js/rsbuild-plugin'

import type { Config } from '../config/index.js'
import { debug, isDebug } from '../debug.js'

function toLynxPluginOptions(config: Config): LynxPluginOptions {
  const filename = config.output?.filename
  const bundle = typeof filename === 'string'
    ? filename
    : filename?.bundle ?? filename?.template

  const websocketTransport = config.dev?.client?.websocketTransport

  return {
    ...bundle === undefined ? {} : { output: { filename: { bundle } } },
    ...websocketTransport === undefined
      ? {}
      : { dev: { client: { websocketTransport } } },
  }
}

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

    import('./rsdoctor.plugin.js').then(({ pluginRsdoctor }) =>
      pluginRsdoctor(config.tools?.rsdoctor)
    ),

    import('./statsJson.plugin.js').then(({ pluginStatsJson }) =>
      pluginStatsJson(config)
    ),
  ])

  const promises: Promise<void>[] = [
    Promise.all(defaultPlugins).then(async plugins => {
      const { PLUGIN_LYNX_NAME, pluginLynx } = await import(
        '@lynx-js/rsbuild-plugin'
      )

      // A user who needs to configure the build engine applies `pluginLynx`
      // themselves. Applying it again here would build a second config from
      // the Rspeedy options and overwrite theirs.
      rsbuildInstance.addPlugins([
        ...rsbuildInstance.isPluginExists(PLUGIN_LYNX_NAME)
          ? []
          : pluginLynx(toLynxPluginOptions(config)),
        ...plugins,
      ])
    }),
  ]

  if (isDebug()) {
    debug('apply Rspeedy default debug plugins')
    promises.push(applyDebugPlugins(rsbuildInstance, config))
  }

  await Promise.all(promises)
}
