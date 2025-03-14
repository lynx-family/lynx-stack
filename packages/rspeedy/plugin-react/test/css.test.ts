// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="@lynx-js/vitest-setup/expect.d.ts" />

import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type {
  CSSLoaderOptions,
  PostCSSLoaderOptions,
  Rspack,
} from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import {
  CssExtractRspackPlugin,
  CssExtractWebpackPlugin,
} from '@lynx-js/css-extract-webpack-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'

import { getLoaderOptions } from './getLoaderOptions.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'
import { pluginReactLynx } from '../src/pluginReactLynx.js'

const CSS_REGEXP = /\.css$/.toString()
const SASS_REGEXP = /\.s(?:a|c)ss$/.toString()

describe('Plugins - CSS', () => {
  test('Use css-loader and CssExtractRspackPlugin.loader', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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
    const rsbuild = await createRsbuild(
      {
        cwd: path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          'fixtures/postcss',
        ),
        rsbuildConfig: {
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
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Not has `lightningcss-loader`
    expect(config).not.toHaveLoader('builtin:lightningcss-loader')
  })

  test('Not removing lightningcss-loader when using web', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: {
          web: {},
        },
        plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Has `lightningcss-loader`
    expect(config).toHaveLoader('builtin:lightningcss-loader')

    const lightningcssLoaderOptionsLoaderOptions = getLoaderOptions<
      Rspack.LightningcssLoaderOptions
    >(
      config!,
      'builtin:lightningcss-loader',
    )

    expect(lightningcssLoaderOptionsLoaderOptions).toHaveProperty('targets', [
      'chrome >= 87',
      'edge >= 88',
      'firefox >= 78',
      'safari >= 14',
    ])
  })

  test('Not removing lightningcss-loader when using web and lynx', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
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
    // Web has `lightningcss-loader`
    expect(webConfig).toHaveLoader('builtin:lightningcss-loader')

    const lightningcssLoaderOptionsLoaderOptions = getLoaderOptions<
      Rspack.LightningcssLoaderOptions
    >(
      webConfig!,
      'builtin:lightningcss-loader',
    )

    expect(lightningcssLoaderOptionsLoaderOptions).toHaveProperty('targets', [
      'iOS >= 9',
      'Android >= 4.4',
      'last 2 versions',
      '> 0.2%',
      'not dead',
    ])
  })

  describe('Layers', () => {
    test('Use ignore-css-loader for background layer', async () => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const backgroundRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && rule.issuerLayer === LAYERS.BACKGROUND
        },
      )
      expect(backgroundRule).not.toBeUndefined()

      expect(backgroundRule?.use).not.toBeUndefined()

      expect(backgroundRule).not.toBeUndefined()

      expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [backgroundRule] } }).toHaveLoader(
        CssExtractRspackPlugin.loader,
      )
    })

    test('Use sass-loader for background layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const backgroundRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString()
              === SASS_REGEXP
            && rule.issuerLayer === LAYERS.BACKGROUND
        },
      )

      expect(backgroundRule).not.toBeUndefined()
      expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [backgroundRule] } }).toHaveLoader(
        /sass-loader/,
      )
    })

    test('Use css-loader for main-thread layer', async () => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
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

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /\/css-loader\//,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )

      const cssLoaderOptions = getLoaderOptions<CSSLoaderOptions>({
        module: { rules: [mainThreadRule] },
      }, /\/css-loader\//)

      expect(cssLoaderOptions).not.toBeUndefined()
      expect(cssLoaderOptions?.modules).toHaveProperty(
        'exportOnlyLocals',
        true,
      )
    })

    test('Use css-loader for main-thread layer with cssModule: true', async () => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          tools: {
            cssLoader: {
              modules: true,
            },
          },
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

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /\/css-loader\//,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )

      const cssLoaderOptions = getLoaderOptions<CSSLoaderOptions>({
        module: { rules: [mainThreadRule] },
      }, /\/css-loader\//)

      expect(cssLoaderOptions).not.toBeUndefined()
      expect(cssLoaderOptions?.modules).toStrictEqual({
        exportOnlyLocals: true,
      })
    })

    test('Use css-loader for main-thread layer with cssModule: "local"', async () => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          tools: {
            cssLoader: {
              modules: 'local',
            },
          },
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

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /\/css-loader\//,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )

      const cssLoaderOptions = getLoaderOptions<CSSLoaderOptions>({
        module: { rules: [mainThreadRule] },
      }, /\/css-loader\//)

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

    test('Not use lightningcss-loader for background layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: { lynx: {} },
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const backgroundRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && rule.issuerLayer === LAYERS.BACKGROUND
        },
      )
      expect(backgroundRule).not.toBeUndefined()
      expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
        'builtin:lightningcss-loader',
      )
    })

    test('Not use type-css-module-loader for background layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const { pluginTypedCSSModules } = await import(
        '@rsbuild/plugin-typed-css-modules'
      )
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          plugins: [
            pluginTypedCSSModules(),
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const backgroundRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString() === CSS_REGEXP
            && rule.issuerLayer === LAYERS.BACKGROUND
        },
      )
      expect(backgroundRule).not.toBeUndefined()
      expect({ module: { rules: [backgroundRule] } }).not.toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [backgroundRule] } }).toHaveLoader(
        /plugin-typed-css-modules/,
      )
    })

    test('Use CssExtractRspackPlugin.loader for main-thread layer', async () => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
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

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        CssExtractRspackPlugin.loader,
      )
    })

    test('Use sass-loader for main-thread layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString()
              === SASS_REGEXP
            && rule.issuerLayer === LAYERS.MAIN_THREAD
        },
      )

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /sass-loader/,
      )
    })

    test('Use type-css-module-loader for main-thread layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const { pluginTypedCSSModules } = await import(
        '@rsbuild/plugin-typed-css-modules'
      )
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: { lynx: {} },
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
            pluginTypedCSSModules(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString()
              === SASS_REGEXP
            && rule.issuerLayer === LAYERS.MAIN_THREAD
        },
      )

      expect(mainThreadRule).not.toBeUndefined()

      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /sass-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        /plugin-typed-css-modules/,
      )
    })

    test('Not use lightningcss-loader for main-thread layer', async () => {
      const { pluginSass } = await import('@rsbuild/plugin-sass')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: { lynx: {} },
          plugins: [
            pluginReactLynx(),
            pluginSass(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const mainThreadRule = config?.module?.rules?.find(
        (rule): rule is Rspack.RuleSetRule => {
          return !!rule && rule !== '...'
            && (rule.test as RegExp | undefined)?.toString()
              === SASS_REGEXP
            && rule.issuerLayer === LAYERS.MAIN_THREAD
        },
      )

      expect(mainThreadRule).not.toBeUndefined()
      expect({ module: { rules: [mainThreadRule] } }).toHaveLoader(
        /ignore-css-loader/,
      )
      expect({ module: { rules: [mainThreadRule] } }).not.toHaveLoader(
        'builtin:lightningcss-loader',
      )
    })
  })

  describe('Webpack', () => {
    test('Use css-loader with CssExtractWebpackPlugin.loader', async () => {
      const { webpackProvider } = await import('@rsbuild/webpack')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          provider: webpackProvider,
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      // Disable `experiments.css`
      expect(config?.experiments?.css).toBe(undefined)

      expect(config).toHaveLoader(/css-loader/)
      expect(config).toHaveLoader(CssExtractWebpackPlugin.loader)
      expect(config).not.toHaveLoader(CssExtractRspackPlugin.loader)
    })

    test('Do not have lightningcss-loader', async () => {
      const { webpackProvider } = await import('@rsbuild/webpack')
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          provider: webpackProvider,
          plugins: [pluginReactLynx(), pluginStubRspeedyAPI()],
        },
      })

      const [config] = await rsbuild.initConfigs()

      // Has `lightningcss-loader`
      expect(config).not.toHaveLoader('builtin:lightningcss-loader')
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
