// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import { LAYERS, VueWebpackPlugin } from '@lynx-js/vue-webpack-plugin'

import type { PluginVueLynxOptions } from './pluginVueLynx.js'

export function applyLoaders(
  api: RsbuildPluginAPI,
  options: Required<PluginVueLynxOptions>,
): void {
  const {
    compat,
    enableRemoveCSSScope,

    experimental_isLazyBundle,
  } = options

  api.modifyBundlerChain((chain, { CHAIN_ID }) => {
    const experiments = chain.get(
      'experiments',
    ) as Rspack.Configuration['experiments']

    chain.experiments({
      ...experiments,
      layers: true,
    })

    const rule = chain.module.rules.get(CHAIN_ID.RULE.JS)
    // The Rsbuild default loaders:
    // - Rspack:
    //   - builtin:swc-loader
    // - Webpack + plugin-swc:
    //   - swc-loader
    // - Webpack: None
    const uses = rule.uses.entries() ?? {}

    const { output } = api.getRsbuildConfig()

    const inlineSourcesContent: boolean = output?.sourceMap === true || !(
      // `false`
      output?.sourceMap === false
      // `false`
      || output?.sourceMap?.js === false
      // explicitly disable source content
      || output?.sourceMap?.js?.includes('nosources') // cSpell:disable-line
    )

    const backgroundRule = rule.oneOf(LAYERS.BACKGROUND)
    // dprint-ignore
    backgroundRule
      .issuerLayer(LAYERS.BACKGROUND)
      .uses
        .merge(uses)
      .end()
      .use(LAYERS.BACKGROUND)
        .loader(VueWebpackPlugin.loaders.BACKGROUND)
        .options({
          compat,
          enableRemoveCSSScope,
          isDynamicComponent: experimental_isLazyBundle,
          inlineSourcesContent,
        })
      .end()

    const mainThreadRule = rule.oneOf(LAYERS.MAIN_THREAD)

    // dprint-ignore
    mainThreadRule
      .issuerLayer(LAYERS.MAIN_THREAD)
      .uses
        .merge(uses)
      .end()
      // If we have swc-loader, replace it with different options.
      .when(uses[CHAIN_ID.USE.SWC] !== undefined, rule => {
        rule.uses.delete(CHAIN_ID.USE.SWC)
        const swcLoaderRule = uses[CHAIN_ID.USE.SWC]!
          .entries() as Rspack.RuleSetRule
        const swcLoaderOptions = swcLoaderRule
          .options as Rspack.SwcLoaderOptions
        rule.use(CHAIN_ID.USE.SWC)
          .merge(swcLoaderRule)
          .options(
            {
              ...swcLoaderOptions,
              jsc: {
                ...swcLoaderOptions.jsc,
                target: 'es2019',
              },
            } satisfies Rspack.SwcLoaderOptions,
          )
      })
      .use(LAYERS.MAIN_THREAD)
        .loader(VueWebpackPlugin.loaders.MAIN_THREAD)
        .options({
          compat,
          enableRemoveCSSScope,
          inlineSourcesContent,
          isDynamicComponent: experimental_isLazyBundle,
        })
      .end()

    // Clear the Rsbuild default loader.
    rule.uses.clear()
  })
}
