// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'
import { assert, describe, expect, test, vi } from 'vitest'

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { getLoaderOptions } from './getLoaderOptions.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

// The Default JS RegExp of Rsbuild
const SCRIPT_REGEXP = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/

function isRspackRule(rule: unknown): rule is Rspack.RuleSetRule {
  return !!rule && typeof rule === 'object'
}

function getLayerRule(
  swcRule: Rspack.RuleSetRule,
  issuerLayer: string,
) {
  return getJsMainRule(swcRule)?.oneOf?.find(
    (rule): rule is Rspack.RuleSetRule => {
      return isRspackRule(rule) && rule.issuerLayer === issuerLayer
    },
  )
}

function getLayerRules(swcRule: Rspack.RuleSetRule) {
  return getJsMainRule(swcRule)?.oneOf?.filter(
    (rule): rule is Rspack.RuleSetRule => {
      return isRspackRule(rule) && rule.issuerLayer !== undefined
    },
  ) ?? []
}

function getJsMainRule(swcRule: Rspack.RuleSetRule) {
  return swcRule.oneOf?.find((rule): rule is Rspack.RuleSetRule => {
    return isRspackRule(rule)
      && rule.type === 'javascript/auto'
      && rule.resourceQuery === undefined
  })
}

describe('SWC configuration', () => {
  test('defaults', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(getLoaderOptions(config, 'builtin:swc-loader'))
      .toMatchInlineSnapshot(`
        {
          "collectTypeScriptInfo": {
            "exportedEnum": false,
            "typeExports": true,
          },
          "detectSyntax": "auto",
          "env": {
            "include": [
              "transform-nullish-coalescing-operator",
              "transform-optional-chaining",
              "transform-export-namespace-from",
              "transform-logical-assignment-operators",
              "transform-numeric-separator",
              "transform-class-properties",
              "transform-class-static-block",
              "transform-private-methods",
              "transform-private-property-in-object",
            ],
            "targets": {
              "chrome": "120",
            },
          },
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<ROOT>/packages/rspeedy/plugin-react/test/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
              "syntax": "typescript",
              "tsx": false,
            },
            "transform": {
              "decoratorVersion": "2023-11",
              "legacyDecorator": false,
              "optimizer": {
                "simplify": true,
              },
              "useDefineForClassFields": false,
            },
          },
        }
      `)
  })

  test('with tools.swc', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        tools: {
          swc: {
            jsc: {
              transform: {
                useDefineForClassFields: true,
                verbatimModuleSyntax: true,
              },
            },
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    assert(config)

    const swcOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(swcOptions?.jsc?.transform?.useDefineForClassFields).toBe(true)
    expect(swcOptions?.jsc?.transform?.verbatimModuleSyntax).toBe(true)
  })

  test('layers', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const swcRule = config.module.rules.find(
      (rule): rule is Rspack.RuleSetRule => {
        return rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString()
      },
    )
    assert(swcRule)

    // Should have Rsbuild default values
    expect(getLayerRule(swcRule, LAYERS.BACKGROUND)?.type).toBe(
      'javascript/auto',
    )
    expect(getLayerRule(swcRule, LAYERS.MAIN_THREAD)?.type).toBe(
      'javascript/auto',
    )
    expect(swcRule.include).toMatchInlineSnapshot(`
      [
        {
          "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        /\\[\\\\\\\\/\\]@rsbuild\\[\\\\\\\\/\\]core\\[\\\\\\\\/\\]dist\\[\\\\\\\\/\\]/,
        "<ROOT>/packages/react",
        /\\\\\\.\\(\\?:js\\|jsx\\|mjs\\|cjs\\|ts\\|tsx\\|mts\\|cts\\)\\$/,
      ]
    `)

    const jsMainRule = getJsMainRule(swcRule)
    assert(jsMainRule)

    // Rsbuild default JS branch should be kept, but its direct loader should
    // be replaced by nested ReactLynx layer branches.
    expect(jsMainRule?.use).toBeUndefined()
    expect(jsMainRule?.loader).toBeUndefined()
    expect(jsMainRule?.options).toBeUndefined()

    // 1. Background Layer
    // 2. MainThread Layer
    expect(getLayerRules(swcRule)).toHaveLength(2)

    const backgroundRules = jsMainRule?.oneOf?.find(rule =>
      isRspackRule(rule) && rule.issuerLayer === LAYERS.BACKGROUND
    )
    assert(backgroundRules)
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      'builtin:swc-loader',
    )
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
    expect({ module: { rules: [backgroundRules] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )

    const mainThreadRules = jsMainRule?.oneOf?.find(rule =>
      isRspackRule(rule) && rule.issuerLayer === LAYERS.MAIN_THREAD
    )
    assert(mainThreadRules)
    expect({ module: { rules: [mainThreadRules] } }).toHaveLoader(
      'builtin:swc-loader',
    )
    expect({ module: { rules: [mainThreadRules] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )
    expect({ module: { rules: [mainThreadRules] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
  })

  test('layers - main-thread uses es2019 env (no jsc.target)', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const swcRule = config.module.rules.find(
      (rule): rule is Rspack.RuleSetRule => {
        return rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString()
      },
    )
    assert(swcRule)

    const mainThreadRule = getLayerRule(swcRule, LAYERS.MAIN_THREAD)
    assert(mainThreadRule)
    expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
      'builtin:swc-loader',
    )
    expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )
    expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
    const mainThreadLoaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>({
      module: {
        rules: [mainThreadRule],
      },
    }, 'builtin:swc-loader')
    // The main thread baseline is expressed via `env` (es2019-equivalent),
    // not `jsc.target`.
    expect(mainThreadLoaderOptions?.jsc?.target).toBeUndefined()
    expect(mainThreadLoaderOptions?.env?.targets).toEqual({ chrome: '120' })
    expect(mainThreadLoaderOptions?.env?.include).toContain(
      'transform-optional-chaining',
    )
    // es2019 does not lower es2016~es2018 syntax, so those transforms are absent.
    expect(mainThreadLoaderOptions?.env?.include).not.toContain(
      'transform-async-to-generator',
    )
  })

  test('user-configured jsc.target is rejected', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        tools: {
          swc: {
            jsc: {
              target: 'es2022',
            },
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    // Rspeedy manages the compilation target via `env`, so a user-set
    // `jsc.target` is rejected (the baseline is mutually exclusive with it).
    await expect(rsbuild.initConfigs()).rejects.toThrowError(
      /Rspeedy manages the SWC compilation target via `env`/,
    )
  })

  test('layers - user env.include is merged into both layers', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        tools: {
          swc: {
            env: {
              include: ['transform-block-scoping'],
            },
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const swcRule = config.module.rules.find(
      (rule): rule is Rspack.RuleSetRule => {
        return rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString()
      },
    )
    assert(swcRule)

    // Background (es2015) keeps the user transform on top of its baseline.
    const backgroundRule = getLayerRule(swcRule, LAYERS.BACKGROUND)
    assert(backgroundRule)
    const backgroundLoaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>({
      module: { rules: [backgroundRule] },
    }, 'builtin:swc-loader')
    expect(backgroundLoaderOptions?.env?.include).toContain(
      'transform-block-scoping',
    )
    expect(backgroundLoaderOptions?.env?.include).toContain(
      'transform-async-to-generator',
    )

    // Main thread (es2019) keeps the user transform too, but stays
    // es2019-equivalent (no es2016~es2019 transforms).
    const mainThreadRule = getLayerRule(swcRule, LAYERS.MAIN_THREAD)
    assert(mainThreadRule)
    const mainThreadLoaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>({
      module: { rules: [mainThreadRule] },
    }, 'builtin:swc-loader')
    expect(mainThreadLoaderOptions?.env?.include).toContain(
      'transform-block-scoping',
    )
    expect(mainThreadLoaderOptions?.env?.include).toContain(
      'transform-optional-chaining',
    )
    expect(mainThreadLoaderOptions?.env?.include).not.toContain(
      'transform-async-to-generator',
    )
  })

  test('`include` defaults to all js file if not configured by user', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          include: [],
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const swcRule = config.module.rules.find(
      (rule): rule is Rspack.RuleSetRule => {
        return rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString()
      },
    )
    assert(swcRule)

    // Should have Rsbuild default values
    expect(getLayerRule(swcRule, LAYERS.BACKGROUND)?.type).toBe(
      'javascript/auto',
    )
    expect(getLayerRule(swcRule, LAYERS.MAIN_THREAD)?.type).toBe(
      'javascript/auto',
    )
    expect(swcRule.include).toMatchInlineSnapshot(`
      [
        {
          "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        "<ROOT>/packages/react",
      ]
    `)
  })
})
