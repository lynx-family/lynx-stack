// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

// The transforms an `es2019` SWC target lowers (ES2020+ syntax), expressed as
// an explicit `env.include` so the main thread no longer relies on
// `jsc.target` (mutually exclusive with `env`). Output is unchanged.
const MAIN_THREAD_ENV_INCLUDE = [
  // ES2020
  'transform-nullish-coalescing-operator',
  'transform-optional-chaining',
  'transform-export-namespace-from',
  // ES2021
  'transform-logical-assignment-operators',
  'transform-numeric-separator',
  // ES2022
  'transform-class-properties',
  'transform-class-static-block',
  'transform-private-methods',
  'transform-private-property-in-object',
]

// A high baseline so `env` auto-includes nothing beyond the explicit list.
const MAIN_THREAD_ENV_TARGETS = { chrome: '120' }

function getLoaderOptions(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
  isMainThread = false,
) {
  const { output } = api.getRsbuildConfig()

  const inlineSourcesContent: boolean = output?.sourceMap === true || !(
    // `false`
    output?.sourceMap === false
    // `false`
    || output?.sourceMap?.js === false
    // explicitly disable source content
    || output?.sourceMap?.js?.includes('nosources')
  )

  const {
    compat,
    enableRemoveCSSScope,
    shake,
    defineDCE,
    engineVersion,
    enableUiSourceMap,

    experimental_isLazyBundle,
    experimental_useElementTemplate,
  } = options

  return {
    compat,
    enableRemoveCSSScope,
    isDynamicComponent: experimental_isLazyBundle,
    inlineSourcesContent,
    defineDCE,
    engineVersion,
    experimental_useElementTemplate,
    ...isMainThread
      ? {
        enableUiSourceMap,
        shake,
      }
      : {},
  }
}

const TESTING_RULE_NAME = 'react:testing'
export function applyTestingLoaders(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  api.modifyBundlerChain((chain, { CHAIN_ID }) => {
    const rule = chain.module
      .rule(CHAIN_ID.RULE.JS)
      .oneOf(CHAIN_ID.ONE_OF.JS_MAIN)

    rule
      .use(TESTING_RULE_NAME)
      .loader(ReactWebpackPlugin.loaders.TESTING)
      .options(getLoaderOptions(api, options))
      .end()
  })
}

export function applyLoaders(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  api.modifyBundlerChain((chain, { CHAIN_ID }) => {
    const rule = chain.module.rule(CHAIN_ID.RULE.JS)
    const jsMainRule = rule.oneOf(CHAIN_ID.ONE_OF.JS_MAIN)
    const type = jsMainRule.get('type') as string | undefined
    // The Rsbuild default loaders:
    // - Rspack:
    //   - builtin:swc-loader
    const uses = jsMainRule.uses.entries() ?? {}

    jsMainRule.uses.clear()

    const backgroundRule = jsMainRule.oneOf(LAYERS.BACKGROUND)
    // dprint-ignore
    backgroundRule
      .issuerLayer(LAYERS.BACKGROUND)
      .when(type !== undefined, rule => {
        rule.type(type!)
      })
      .uses
        .merge(uses)
      .end()
      .use(LAYERS.BACKGROUND)
        .loader(ReactWebpackPlugin.loaders.BACKGROUND)
        .options(getLoaderOptions(api, options))
      .end()

    const mainThreadRule = jsMainRule.oneOf(LAYERS.MAIN_THREAD)

    // dprint-ignore
    mainThreadRule
      .issuerLayer(LAYERS.MAIN_THREAD)
      .when(type !== undefined, rule => {
        rule.type(type!)
      })
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
        // `jsc.target` and `env` can't coexist in SWC: drop the target and
        // express the fixed es2019 main-thread baseline through `env`. The
        // main thread targets an es2019 engine, so its baseline is a platform
        // constant — user `tools.swc.env.include` only extends the base/
        // background config, matching the previous `jsc.target` behavior.
        const jsc = { ...swcLoaderOptions.jsc } as Record<string, unknown>
        delete jsc['target']
        rule.use(CHAIN_ID.USE.SWC)
          .merge(swcLoaderRule)
          .options(
            {
              ...swcLoaderOptions,
              jsc,
              env: {
                targets: MAIN_THREAD_ENV_TARGETS,
                include: MAIN_THREAD_ENV_INCLUDE,
              },
            } satisfies Rspack.SwcLoaderOptions,
          )
      })
      .use(LAYERS.MAIN_THREAD)
        .loader(ReactWebpackPlugin.loaders.MAIN_THREAD)
        .options(getLoaderOptions(api, options, true))
      .end()
  })
}
