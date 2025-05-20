// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'

import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import {
  LAYERS,
  getBackgroundTransformOptions,
  getCompatOptions,
  getMainThreadTransformOptions,
} from '@lynx-js/react-webpack-plugin'
import type { SwcPluginReactLynxOptions } from '@lynx-js/swc-plugin-reactlynx'
import type { CompatVisitorConfig } from '@lynx-js/swc-plugin-reactlynx-compat'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

const require = createRequire(import.meta.url)

// TODO(BitterGourd): Rename and Refactor
export function applyLoaders(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const {
    compat,
    enableRemoveCSSScope,
    shake,
    defineDCE,

    experimental_isLazyBundle,
  } = options

  api.modifyBundlerChain((chain, { CHAIN_ID, isDev }) => {
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

    const reactLoaderOptions = {
      enableRemoveCSSScope,
      shake,
      defineDCE,
      isDynamicComponent: experimental_isLazyBundle,
    }

    const mainThreadCompatOptions = getCompatOptions(
      compat as CompatVisitorConfig,
      LAYERS.MAIN_THREAD,
    )

    const backgroundCompatOptions = getCompatOptions(
      compat as CompatVisitorConfig,
      LAYERS.BACKGROUND,
    )

    const mainThreadTransformOptions = getMainThreadTransformOptions(
      reactLoaderOptions,
      isDev,
    )

    const backgroundTransformOptions = getBackgroundTransformOptions(
      reactLoaderOptions,
      isDev,
    )

    const backgroundRule = rule.oneOf(LAYERS.BACKGROUND)
    // dprint-ignore
    backgroundRule
      .issuerLayer(LAYERS.BACKGROUND)
      .uses
        .merge(uses)
      .end()
      .when(uses[CHAIN_ID.USE.SWC] !== undefined, rule => {
        rule.uses.delete(CHAIN_ID.USE.SWC)
        const swcLoaderRule = uses[CHAIN_ID.USE.SWC]!
          .entries() as Rspack.RuleSetRule

        const swcLoaderOptions = getBackgroundSwcLoaderOptions(
          swcLoaderRule.options as Rspack.SwcLoaderOptions, 
          backgroundTransformOptions, 
          backgroundCompatOptions,
        )

        rule.use(CHAIN_ID.USE.SWC)
          .merge(swcLoaderRule)
          .options(swcLoaderOptions)
      })

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

        const swcLoaderOptions = getMainThreadSwcLoaderOptions(
          swcLoaderRule.options as Rspack.SwcLoaderOptions, 
          mainThreadTransformOptions, 
          mainThreadCompatOptions,
        )

        rule.use(CHAIN_ID.USE.SWC)
          .merge(swcLoaderRule)
          .options(swcLoaderOptions)
      })

    // Clear the Rsbuild default loader.
    // Otherwise, the JSX will be transformed by the `builtin:swc-loader`.
    rule.uses.clear()
  })
}

function getMainThreadSwcLoaderOptions(
  options: Rspack.SwcLoaderOptions,
  mainThreadTransformOptions: SwcPluginReactLynxOptions,
  mainThreadCompatOptions: CompatVisitorConfig | false,
): Rspack.SwcLoaderOptions {
  const swcLoaderOptions = {
    ...options,
    jsc: {
      ...options.jsc,
      target: 'es2019',
      experimental: {
        ...options.jsc?.experimental,
        plugins: [
          ...(options.jsc?.experimental?.plugins ?? []),
          [
            require.resolve('@lynx-js/react/transform/swc-plugin-reactlynx'),
            mainThreadTransformOptions,
          ],
        ],
      },
    },
  }

  // When Passing to SWC, the swc-plugin-reactlynx-compat Must Be Placed Before swc-plugin-reactlynx
  if (mainThreadCompatOptions) {
    swcLoaderOptions.jsc.experimental.plugins.unshift([
      require.resolve('@lynx-js/react/transform/swc-plugin-reactlynx-compat'),
      mainThreadCompatOptions,
    ])
  }

  return swcLoaderOptions as Rspack.SwcLoaderOptions
}

function getBackgroundSwcLoaderOptions(
  options: Rspack.SwcLoaderOptions,
  backgroundTransformOptions: SwcPluginReactLynxOptions,
  backgroundCompatOptions: CompatVisitorConfig | false,
): Rspack.SwcLoaderOptions {
  const swcLoaderOptions = {
    ...options,
    jsc: {
      ...options.jsc,
      experimental: {
        ...options.jsc?.experimental,
        plugins: [
          ...(options.jsc?.experimental?.plugins ?? []),
          [
            require.resolve('@lynx-js/react/transform/swc-plugin-reactlynx'),
            backgroundTransformOptions,
          ],
        ],
      },
    },
  }

  // When Passing to SWC, the swc-plugin-reactlynx-compat Must Be Placed Before swc-plugin-reactlynx
  if (backgroundCompatOptions) {
    swcLoaderOptions.jsc.experimental.plugins.unshift([
      require.resolve('@lynx-js/react/transform/swc-plugin-reactlynx-compat'),
      backgroundCompatOptions,
    ])
  }

  return swcLoaderOptions as Rspack.SwcLoaderOptions
}
