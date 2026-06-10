// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { RsbuildInstance, RsbuildPlugin, Rspack } from '@rsbuild/core'

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

    import('@lynx-js/debug-metadata-rsbuild-plugin').then(
      ({ pluginLynxDebugMetadata }) => pluginLynxDebugMetadata(),
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

    import('./statsJson.plugin.js').then(({ pluginStatsJson }) =>
      pluginStatsJson(config)
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

  // Apply `@rsbuild/plugin-type-check` by default, unless the user already added
  // their own type-check plugin or opted out with `RSPEEDY_TYPE_CHECK=false`.
  const { pluginTypeCheck, PLUGIN_TYPE_CHECK_NAME } = await import(
    '@rsbuild/plugin-type-check'
  )
  if (
    process.env['RSPEEDY_TYPE_CHECK'] !== 'false'
    && !rsbuildInstance.isPluginExists(PLUGIN_TYPE_CHECK_NAME)
  ) {
    const typeCheck = pluginTypeCheck()
    rsbuildInstance.addPlugins([
      {
        name: PLUGIN_TYPE_CHECK_NAME,
        setup(api) {
          // Skip the type checker during `dev` to keep the dev loop fast. Other
          // commands (`build`, `preview`, `inspect`) only actually type-check
          // when they compile, i.e. during `build`.
          if (api.context.action === 'dev') {
            return
          }
          // On type errors, hint that the built-in type checker can be turned
          // off. Detected by the TypeScript diagnostic code (`TS1234:`) in the
          // build errors — `ts-checker-rspack-plugin` does not expose its issue
          // hook from its public entry.
          let hintShown = false
          api.onAfterCreateCompiler(({ compiler }) => {
            const compilers = 'compilers' in compiler
              ? compiler.compilers
              : [compiler]
            for (const c of compilers) {
              c.hooks.done.tap(
                'rspeedy:type-check-hint',
                (stats: Rspack.Stats) => {
                  if (hintShown) {
                    return
                  }
                  const { errors } = stats.toJson({ errors: true, all: false })
                  if (
                    errors?.some((error) => /\bTS\d+:/.test(error.message))
                  ) {
                    hintShown = true
                    logger.warn(
                      'Found type errors. Set `RSPEEDY_TYPE_CHECK=false` to disable the built-in type checker.',
                    )
                  }
                },
              )
            }
          })
          return typeCheck.setup(api)
        },
      },
    ])
  }
}
