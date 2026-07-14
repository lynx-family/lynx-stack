// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import type { RsbuildPluginAPI, Rspack, RspackChain } from '@rsbuild/core'

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'
import { resolveStripAllComponents } from './stripComponents.js'

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
  stripAllComponents = false,
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
        // The compile-time half of a root-level `<Background>`: only the
        // main-thread (LEPUS) loader empties component render bodies.
        stripAllComponents,
      }
      : {},
  }
}

/**
 * Collect the source files an entry pulls in, so they can be scanned for a
 * root-level `<Background>`. Paths are resolved against the project root so a
 * relative entry (`./src/index.tsx`) is readable; bare specifiers and injected
 * runtime entries survive resolution as non-existent paths, and
 * {@link resolveStripAllComponents} skips whatever it cannot read.
 */
function collectEntryImports(
  chain: RspackChain,
  rootPath: string,
): Set<string> {
  const files = new Set<string>()
  const add = (item: unknown) => {
    if (typeof item === 'string') {
      files.add(path.resolve(rootPath, item))
    }
  }
  const entryPoints = chain.entryPoints.entries() ?? {}
  for (const entryPoint of Object.values(entryPoints)) {
    for (const value of entryPoint.values()) {
      if (typeof value === 'string' || Array.isArray(value)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          add(item)
        }
      } else if (value && typeof value === 'object' && 'import' in value) {
        const imports = (value as { import?: string | string[] }).import
        for (const item of Array.isArray(imports) ? imports : [imports]) {
          add(item)
        }
      }
    }
  }
  return files
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
    // A root-level `<Background>` (or the explicit `experimental_stripAllComponents`
    // switch) turns on emptying every component body from the main-thread bundle.
    const stripAllComponents = resolveStripAllComponents(
      options.experimental_stripAllComponents,
      collectEntryImports(chain, api.context.rootPath),
    )

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
                ...swcLoaderOptions.env,
                targets: MAIN_THREAD_ENV_TARGETS,
                // Lower `let`/`const` to `var`; QuickJS parses `var` faster.
                // Spreading `swcLoaderOptions.env` carries `exclude` through,
                // so the background opt-out also applies here.
                include: ['transform-block-scoping', ...MAIN_THREAD_ENV_INCLUDE],
              },
            } satisfies Rspack.SwcLoaderOptions,
          )
      })
      .use(LAYERS.MAIN_THREAD)
        .loader(ReactWebpackPlugin.loaders.MAIN_THREAD)
        .options(getLoaderOptions(api, options, true, stripAllComponents))
      .end()
  })
}
