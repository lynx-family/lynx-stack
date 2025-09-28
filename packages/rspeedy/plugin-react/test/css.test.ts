// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="@lynx-js/vitest-setup/expect.d.ts" />

import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRegExp } from 'node:util/types'

import type {
  CSSLoaderOptions,
  PostCSSLoaderOptions,
  Rspack,
} from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { getLoaderOptions } from './getLoaderOptions.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'
import { pluginReactLynx } from '../src/pluginReactLynx.js'

const CSS_REGEXP = /\.css$/.toString()
const SASS_REGEXP = /\.s(?:a|c)ss$/.toString()

describe('Plugins - CSS', () => {
  test('Use css-loader and CssExtractRspackPlugin.loader', async () => {
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Disable `experiments.css`
    expect(config?.experiments?.css).toBe(undefined)

    // Has `CssExtractRspackPlugin.loader`
    expect(config).toHaveLoader(CssExtractRspackPlugin.loader)

    // Has `css-loader`
    expect(config).toHaveLoader(/css-loader/)
  })

  test('Add custom postcss plugins', async () => {
    const rsbuild = await createRspeedy(
      {
        cwd: path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          'fixtures/postcss',
        ),
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      },
    )
    const [config] = await rsbuild.initConfigs()

    expect(config).toHaveLoader(/postcss-loader/)

    const postCSSLoaderOptions = getLoaderOptions<PostCSSLoaderOptions>(
      config!,
      /postcss-loader/,
    )

    expect(postCSSLoaderOptions?.postcssOptions).toHaveProperty('plugins')

    if (typeof postCSSLoaderOptions?.postcssOptions === 'function') {
      expect.fail('postcssOptions should not be function')
    }
    expect(postCSSLoaderOptions?.postcssOptions?.plugins).toHaveLength(1)
    expect(postCSSLoaderOptions?.postcssOptions?.plugins?.[0]).toHaveProperty(
      'postcssPlugin',
      'tailwindcss',
    )
  })

  test('Remove lightningcss-loader', async () => {
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Not has `lightningcss-loader`
    expect(config).not.toHaveLoader('builtin:lightningcss-loader')
  })

  test('Remove lightningcss-loader when using web', async () => {
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: {
          web: {},
        },
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Has `lightningcss-loader`
    expect(config).not.toHaveLoader('builtin:lightningcss-loader')
  })

  test('Not removing lightningcss-loader when using web and lynx', async () => {
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: {
          lynx: {},
          web: {
            output: {
              overrideBrowserslist: [
                'iOS >= 9',
                'Android >= 4.4',
                'last 2 versions',
                '> 0.2%',
                'not dead',
              ],
            },
          },
        },
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [lynxConfig, webConfig] = await rsbuild.initConfigs()

    // Lynx not has `lightningcss-loader`
    expect(lynxConfig).not.toHaveLoader('builtin:lightningcss-loader')
    // Web not has `lightningcss-loader`
    expect(webConfig).not.toHaveLoader('builtin:lightningcss-loader')
  })

  describe('Layers', () => {
    test('Use css-loader', async () => {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const cssRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
        },
      )
      expect(cssRule).not.toBeUndefined()

      expect(cssRule?.use).not.toBeUndefined()

      expect(cssRule).not.toBeUndefined()

      expect({ module: { rules: [cssRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        CssExtractRspackPlugin.loader,
      )
    })

    test('Use sass-loader', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const sassRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString()
              === SASS_REGEXP
        },
      )

      expect(sassRule).not.toBeUndefined()
      expect({ module: { rules: [sassRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [sassRule] } }).toHaveLoader(
        /sass-loader/,
      )
    })

    test('No main-thread/background layer only css rules', async () => {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && rule.issuerLayer === LAYERS.MAIN_THREAD
        },
      )

      expect(mainThreadRule).toBeUndefined()

      const backgroundRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && rule.issuerLayer === LAYERS.BACKGROUND
        },
      )

      expect(backgroundRule).toBeUndefined()
    })

    test('Use css-loader with cssModule: true', async () => {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          tools: {
            cssLoader: {
              modules: true,
            },
          },
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const cssRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
        },
      )

      expect(cssRule).not.toBeUndefined()
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        /[\\/]css-loader[\\/]/,
      )
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        CssExtractRspackPlugin.loader,
      )

      const cssLoaderOptions = getLoaderOptions<CSSLoaderOptions>({
        module: { rules: [cssRule] },
      }, /[\\/]css-loader[\\/]/)

      expect(cssLoaderOptions).not.toBeUndefined()
      expect(cssLoaderOptions?.modules).toStrictEqual({
        exportOnlyLocals: true,
      })
    })

    test('Use css-loader with cssModule: "local"', async () => {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          tools: {
            cssLoader: {
              modules: 'local',
            },
          },
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const cssRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
        },
      )

      expect(cssRule).not.toBeUndefined()
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        /[\\/]css-loader[\\/]/,
      )
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        CssExtractRspackPlugin.loader,
      )

      const cssLoaderOptions = getLoaderOptions<CSSLoaderOptions>({
        module: { rules: [cssRule] },
      }, /[\\/]css-loader[\\/]/)

      expect(cssLoaderOptions).not.toBeUndefined()
      expect(cssLoaderOptions?.modules).toHaveProperty(
        'exportOnlyLocals',
        true,
      )
      expect(cssLoaderOptions?.modules).toHaveProperty(
        'mode',
        'local',
      )
    })

    test('Not use lightningcss-loader', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          environments: { lynx: {} },
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const cssRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
        },
      )
      expect(cssRule).not.toBeUndefined()
      expect({ module: { rules: [cssRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [cssRule] } }).not.toHaveLoader(
        'builtin:lightningcss-loader',
      )
    })

    test('Use type-css-module-loader', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const { pluginTypedCSSModules } = await import(
        '@rsbuild/plugin-typed-css-modules'
      )
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginTypedCSSModules(),
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const cssRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
        },
      )
      expect(cssRule).not.toBeUndefined()
      expect({ module: { rules: [cssRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [cssRule] } }).toHaveLoader(
        /plugin-typed-css-modules/,
      )
    })
  })

  describe('Inline CSS', () => {
    test('Use css-loader only', async () => {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && isRegExp(rule.resourceQuery)
            && rule.resourceQuery.test('?inline')
        },
      )

      expect(mainThreadRule).not.toBeUndefined()

      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /[\\/]css-loader[\\/]/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )
    })

    test('Use sass-loader and css-loader only', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginSass(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === SASS_REGEXP
            && isRegExp(rule.resourceQuery)
            && rule.resourceQuery.test('?inline')
        },
      )

      expect(mainThreadRule).not.toBeUndefined()

      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /sass-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /[\\/]css-loader[\\/]/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )
    })
  })

  describe('minification', () => {
    test('default', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rspeedy.initConfigs()

      expect(
        config?.optimization?.minimizer?.find(minimizer =>
          minimizer && minimizer !== '...'
          && minimizer.constructor.name === 'CssMinimizerPlugin'
        ),
      ).toBeDefined()
    })

    test('with enableRemoveCSSScope: false', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx({
              enableRemoveCSSScope: false,
            }),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      expect(
        config?.optimization?.minimizer?.find(minimizer =>
          minimizer && minimizer !== '...'
          && minimizer.constructor.name === 'CssMinimizerPlugin'
        ),
      ).toBeDefined()
    })
  })
})
