// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import { assert, describe, expect, test, vi } from 'vitest'

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

import { getLoaderOptions } from './getLoaderOptions.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

// The Default JS RegExp of Rsbuild
const SCRIPT_REGEXP = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/

describe('SWC configuration', () => {
  test('defaults', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          {
            name: 'test:swc',
            setup(api: RsbuildPluginAPI) {
              api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
                return mergeRsbuildConfig(config, {
                  tools: {
                    swc(config) {
                      // Rspeedy does this
                      delete config.env
                      return config
                    },
                  },
                })
              })
            },
          },
          pluginStubRspeedyAPI(),
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(getLoaderOptions(config, 'builtin:swc-loader'))
      .toMatchInlineSnapshot(`
        {
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<WORKSPACE>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "parser": {
              "decorators": true,
              "syntax": "typescript",
              "tsx": false,
            },
            "transform": {
              "decoratorVersion": "2022-03",
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
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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

    // Should have Rsbuild default values
    expect(swcRule.type).toBe('javascript/auto')
    expect(swcRule.include).toMatchInlineSnapshot(`
      [
        {
          "and": [
            "<WORKSPACE>",
            {
              "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
            },
          ],
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        /\\[\\\\\\\\/\\]@rsbuild\\[\\\\\\\\/\\]core\\[\\\\\\\\/\\]dist\\[\\\\\\\\/\\]/,
        "<WORKSPACE>/packages/react",
        /\\\\\\.\\(\\?:js\\|mjs\\|cjs\\)\\$/,
      ]
    `)

    // Rsbuild default loader should be removed
    expect(swcRule.use).toBeUndefined()
    expect(swcRule.loader).toBeUndefined()
    expect(swcRule.options).toBeUndefined()

    // 1. Background Layer
    // 2. MainThread Layer
    expect(swcRule.oneOf).toHaveLength(2)

    const backgroundRules = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.BACKGROUND
    )
    expect(backgroundRules).not.toBeUndefined()
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      'builtin:swc-loader',
    )
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
    expect({ module: { rules: [backgroundRules] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )

    const mainThreadRules = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.MAIN_THREAD
    )
    expect(mainThreadRules).not.toBeUndefined()
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

  test('layers - webpack', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginSwc } = await import('@rsbuild/plugin-webpack-swc')
    const { webpackProvider } = await import('@rsbuild/webpack')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        provider: webpackProvider,
        plugins: [
          pluginSwc(),
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
            // The Default JS RegExp of Rsbuild
            === (/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/).toString()
      },
    )

    // Should have Rsbuild default values
    expect(swcRule.type).toBe('javascript/auto')
    expect(swcRule.include).toMatchInlineSnapshot(`
      [
        {
          "and": [
            "<WORKSPACE>",
            {
              "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
            },
          ],
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        /\\[\\\\\\\\/\\]@rsbuild\\[\\\\\\\\/\\]core\\[\\\\\\\\/\\]dist\\[\\\\\\\\/\\]/,
        "<WORKSPACE>/packages/react",
        /\\\\\\.\\(\\?:js\\|mjs\\|cjs\\)\\$/,
      ]
    `)

    // Rsbuild default loader should be removed
    expect(swcRule.use).toBeUndefined()
    expect(swcRule.loader).toBeUndefined()
    expect(swcRule.options).toBeUndefined()

    // 1. Background Layer
    // 2. MainThread Layer
    expect(swcRule.oneOf).toHaveLength(2)

    const backgroundRules = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.BACKGROUND
    )
    expect(backgroundRules).not.toBeUndefined()
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      /@rsbuild\/plugin-webpack-swc/,
    )
    expect({ module: { rules: [backgroundRules] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
    expect({ module: { rules: [backgroundRules] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )

    const mainThreadRules = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.MAIN_THREAD
    )
    expect(mainThreadRules).not.toBeUndefined()
    expect({ module: { rules: [mainThreadRules] } }).toHaveLoader(
      /@rsbuild\/plugin-webpack-swc/,
    )
    expect({ module: { rules: [mainThreadRules] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )
    expect({ module: { rules: [mainThreadRules] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
  })

  test('layers - main-thread default target', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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

    const mainThreadRule = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.MAIN_THREAD
    )
    expect(mainThreadRule).not.toBeUndefined()
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
    expect(mainThreadLoaderOptions.jsc.target).toBe('es2019')
  })

  test('layers - main-thread custom target', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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

    const [config] = await rsbuild.initConfigs()

    const swcRule = config.module.rules.find(
      (rule): rule is Rspack.RuleSetRule => {
        return rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString()
      },
    )

    const backgroundRule = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.BACKGROUND
    )
    expect(backgroundRule).not.toBeUndefined()
    expect({ module: { rules: [backgroundRule] } }).toHaveLoader(
      'builtin:swc-loader',
    )
    expect({ module: { rules: [backgroundRule] } }).toHaveLoader(
      ReactWebpackPlugin.loaders.BACKGROUND,
    )
    expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
      ReactWebpackPlugin.loaders.MAIN_THREAD,
    )

    const backgroundLoaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>({
      module: {
        rules: [backgroundRule],
      },
    }, 'builtin:swc-loader')
    expect(backgroundLoaderOptions.jsc.target).toBe('es2022')

    const mainThreadRule = swcRule.oneOf.find(rule =>
      rule.issuerLayer === LAYERS.MAIN_THREAD
    )
    expect(mainThreadRule).not.toBeUndefined()
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
    expect(mainThreadLoaderOptions.jsc.target).toBe('es2019')
  })

  test('`include` defaults to all js file if not configured by user', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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

    // Should have Rsbuild default values
    expect(swcRule.type).toBe('javascript/auto')
    expect(swcRule.include).toMatchInlineSnapshot(`
      [
        {
          "and": [
            "<WORKSPACE>",
            {
              "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
            },
          ],
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        /\\[\\\\\\\\/\\]@rsbuild\\[\\\\\\\\/\\]core\\[\\\\\\\\/\\]dist\\[\\\\\\\\/\\]/,
        "<WORKSPACE>/packages/react",
      ]
    `)
  })
})
