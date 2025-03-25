// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'

import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import type {
  CompatVisitorConfig,
} from '@lynx-js/react/transform/swc-plugin-compat'
import {
  LAYERS,
  getBackgroundCompatOptions,
  getBackgroundTransformOptions,
  getMainThreadCompatOptions,
  getMainThreadTransformOptions,
} from '@lynx-js/react-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

const require = createRequire(import.meta.url)

export function applyLoaders(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const {
    compat,
    enableRemoveCSSScope,
    jsx,
    shake,
    defineDCE,
    experimental_isLazyBundle,
  } = options

  const reactLynxTransformOptions = {
    enableRemoveCSSScope,
    jsx,
    shake,
    defineDCE,
    isDynamicComponent: experimental_isLazyBundle,
  }

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

    const { output } = api.getRsbuildConfig()

    const inlineSourcesContent: boolean = output?.sourceMap === true || !(
      // `false`
      output?.sourceMap === false
      // `false`
      || output?.sourceMap?.js === false
      // explicitly disable source content
      || output?.sourceMap?.js?.includes('nosources') // cSpell:disable-line
    )

    const mainThreadCompatOptions = getMainThreadCompatOptions(
      compat as CompatVisitorConfig,
    )
    const backgroundCompatOptions = getBackgroundCompatOptions(
      compat as CompatVisitorConfig,
    )

    const mainThreadTransformOptions = getMainThreadTransformOptions(
      reactLynxTransformOptions,
      compat as CompatVisitorConfig,
      isDev,
    )
    const backgroundTransformOptions = getBackgroundTransformOptions(
      reactLynxTransformOptions,
      isDev,
    )

    const backgroundRule = rule.oneOf(LAYERS.BACKGROUND)

    const mainThreadRule = rule.oneOf(LAYERS.MAIN_THREAD)

    const getSwcOptions = (
      swcLoaderOptions: Rspack.SwcLoaderOptions,
      layer: string,
    ): Rspack.SwcLoaderOptions => {
      const swcOptions = {
        ...swcLoaderOptions,
        jsc: {
          ...swcLoaderOptions.jsc,
          target: 'es2019',
          transform: {
            react: {
              throwIfNamespace: false,
              importSource: '@lynx-js/react',
              runtime: 'automatic',
            },
          },
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          experimental: {
            plugins: [
              [
                require.resolve(
                  '@lynx-js/react/transform/swc-plugin-react-lynx',
                ),
                layer === LAYERS.MAIN_THREAD
                  ? mainThreadTransformOptions
                  : backgroundTransformOptions,
              ],
            ],
          },
        },
        inlineSourcesContent,
      }

      if (
        layer === LAYERS.MAIN_THREAD
        && typeof mainThreadCompatOptions !== 'boolean'
      ) {
        swcOptions.jsc.experimental.plugins.push([
          require.resolve('@lynx-js/react/transform/swc-plugin-compat'),
          // FIXME(BitterGourd)
          // @ts-expect-error plugin type error
          mainThreadCompatOptions,
        ])
      } else if (
        layer === LAYERS.BACKGROUND
        && typeof backgroundCompatOptions !== 'boolean'
      ) {
        swcOptions.jsc.experimental.plugins.push([
          require.resolve('@lynx-js/react/transform/swc-plugin-compat'),
          // FIXME(BitterGourd)
          // @ts-expect-error plugin type error
          backgroundCompatOptions,
        ])
      }

      return swcOptions as Rspack.SwcLoaderOptions
    }

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
        const swcLoaderOptions = swcLoaderRule
          .options as Rspack.SwcLoaderOptions
          
        rule.use(CHAIN_ID.USE.SWC)
          .merge(swcLoaderRule)
          .options(
            getSwcOptions(swcLoaderOptions,LAYERS.BACKGROUND),
          )
      })

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
            getSwcOptions(swcLoaderOptions,LAYERS.MAIN_THREAD),
          )
      })

    // Clear the Rsbuild default loader.
    // Otherwise, the JSX will be transformed by the `builtin:swc-loader`.
    rule.uses.clear()
  })
}
