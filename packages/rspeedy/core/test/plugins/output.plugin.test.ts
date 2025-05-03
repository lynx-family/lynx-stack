// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'
import { getLoaderOptions } from '../getLoaderOptions.js'

describe('Plugins - Output', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  test('defaults', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.output).toMatchSnapshot()
  })

  test('defaults - Production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.output).toMatchSnapshot()
  })

  test('output.filename', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        filename: 'foo.js',
      },
    })

    const config = await rsbuild.unwrapConfig()
    expect(config.output).toMatchSnapshot()
  })

  test('output.filename.js', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        filename: {
          js: '[name].js',
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    expect(config.output).toMatchSnapshot()
  })

  test('output.assetPrefix', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rsbuild = await createStubRspeedy({
      output: {
        assetPrefix: 'https://foo.example.com/',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.output?.publicPath).toBe('https://foo.example.com/')

    vi.unstubAllEnvs()
  })

  test('output.assetPrefix in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rsbuild = await createStubRspeedy({
      output: {
        assetPrefix: 'https://foo.example.com/',
      },
    })

    const config = await rsbuild.unwrapConfig()

    // This should be `dev.assetPrefix`, which defaults to be `http://<local-ip>:<port>/`
    expect(config.output?.publicPath).not.toContain('foo.example.com')

    vi.unstubAllEnvs()
  })

  test('output.dataUriLimit', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        dataUriLimit: 0,
      },
    })

    const config = await rsbuild.unwrapConfig()

    const assetRules = getAssetRules(config)

    expect(
      assetRules?.filter(rule => rule.parser).map(rule =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        rule.parser?.['dataUrlCondition']
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "maxSize": 0,
        },
        {
          "maxSize": 0,
        },
        {
          "maxSize": 0,
        },
        {
          "maxSize": 0,
        },
      ]
    `)
  })

  test('output.dataUriLimit Number.MAX_SAFE_INTEGER', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        dataUriLimit: Number.MAX_SAFE_INTEGER,
      },
    })

    const config = await rsbuild.unwrapConfig()

    const assetRules = getAssetRules(config)

    expect(
      assetRules?.filter(rule => rule.parser).map(rule =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        rule.parser?.['dataUrlCondition']
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "maxSize": 9007199254740991,
        },
        {
          "maxSize": 9007199254740991,
        },
        {
          "maxSize": 9007199254740991,
        },
        {
          "maxSize": 9007199254740991,
        },
      ]
    `)
  })

  test('output.dataUriLimit NaN', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        dataUriLimit: Number.NaN,
      },
    })

    const config = await rsbuild.unwrapConfig()

    const assetRules = getAssetRules(config)

    expect(
      assetRules?.filter(rule => rule.parser).map(rule =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        rule.parser?.['dataUrlCondition']
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "maxSize": NaN,
        },
        {
          "maxSize": NaN,
        },
        {
          "maxSize": NaN,
        },
        {
          "maxSize": NaN,
        },
      ]
    `)
  })

  describe('output.cssModules', () => {
    test('defaults', async () => {
      const rsbuild = await createStubRspeedy({})

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.auto: true', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            auto: true,
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.auto: false', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            auto: false,
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": false,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.auto: RegExp', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            auto: /module/,
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": /module/,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.auto: function', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            auto(filename) {
              return !filename.includes('node_modules')
            },
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": [Function],
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.exportGlobals', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            exportGlobals: true,
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)
      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": true,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.exportLocalsConvention', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            exportLocalsConvention: 'asIs',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "asIs",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.exportLocalsConvention: \'dashed-only\'', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            exportLocalsConvention: 'dashesOnly',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "dashesOnly",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.localIdentName', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          cssModules: {
            localIdentName: '[local]-[hash]',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[local]-[hash]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.localIdentName in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const rsbuild = await createStubRspeedy({
        output: {},
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[path][name]__[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })

    test('output.cssModules.localIdentName in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const rsbuild = await createStubRspeedy({
        output: {},
      })

      const config = await rsbuild.unwrapConfig()

      const options = getLoaderOptions(config, /css-loader/)

      expect(options).toMatchInlineSnapshot(`
        {
          "importLoaders": 1,
          "modules": {
            "auto": true,
            "exportGlobals": false,
            "exportLocalsConvention": "camelCase",
            "localIdentName": "[local]-[hash:base64:6]",
            "namedExport": false,
          },
          "sourceMap": false,
        }
      `)
    })
  })

  describe('output.distPath', () => {
    test('defaults', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {},
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.path).toMatchInlineSnapshot(`"<WORKSPACE>/dist"`)
      expect(config.output?.filename).toMatchInlineSnapshot(
        `"static/js/[name].js"`,
      )
      expect(config.output?.chunkFilename).toMatchInlineSnapshot(
        `"static/js/async/[name].js"`,
      )

      const cssExtractPlugin = config.plugins?.find((
        plugin,
      ): plugin is Rspack.CssExtractRspackPlugin =>
        !!plugin && plugin.constructor.name === 'CssExtractRspackPlugin'
      )
      expect(cssExtractPlugin?.options.filename).toMatchInlineSnapshot(
        `".rspeedy/[name]/[name].css"`,
      )
      expect(cssExtractPlugin?.options.chunkFilename).toMatchInlineSnapshot(
        `".rspeedy/async/[name]/[name].css"`,
      )
    })

    test('root', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: { root: 'foo' },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.path).toMatchInlineSnapshot(`"<WORKSPACE>/foo"`)
    })

    test('absolute root', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: { root: '/foo' },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.path).toMatchInlineSnapshot(`"/foo"`)
    })

    test('css', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            css: 'css',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const cssExtractPlugin = config.plugins?.find((
        plugin,
      ): plugin is Rspack.CssExtractRspackPlugin =>
        !!plugin && plugin.constructor.name === 'CssExtractRspackPlugin'
      )
      expect(cssExtractPlugin?.options.filename).toMatchInlineSnapshot(
        `"css/[name]/[name].css"`,
      )
      expect(cssExtractPlugin?.options.chunkFilename).toMatchInlineSnapshot(
        `"css/async/[name]/[name].css"`,
      )
    })

    test('cssAsync', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            cssAsync: 'css_chunks',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const cssExtractPlugin = config.plugins?.find((
        plugin,
      ): plugin is Rspack.CssExtractRspackPlugin =>
        !!plugin && plugin.constructor.name === 'CssExtractRspackPlugin'
      )
      expect(cssExtractPlugin?.options.filename).toMatchInlineSnapshot(
        `".rspeedy/[name]/[name].css"`,
      )
      expect(cssExtractPlugin?.options.chunkFilename).toMatchInlineSnapshot(
        `"css_chunks/[name]/[name].css"`,
      )
    })

    test('css with cssAsync', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            css: 'css',
            cssAsync: 'common_css',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      const cssExtractPlugin = config.plugins?.find((
        plugin,
      ): plugin is Rspack.CssExtractRspackPlugin =>
        !!plugin && plugin.constructor.name === 'CssExtractRspackPlugin'
      )
      expect(cssExtractPlugin?.options.filename).toMatchInlineSnapshot(
        `"css/[name]/[name].css"`,
      )
      expect(cssExtractPlugin?.options.chunkFilename).toMatchInlineSnapshot(
        `"common_css/[name]/[name].css"`,
      )
    })

    test('js', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            js: 'common',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.filename).toMatchInlineSnapshot(
        `"common/[name].js"`,
      )
      expect(config.output?.chunkFilename).toMatchInlineSnapshot(
        `"common/async/[name].js"`,
      )
    })

    test('jsAsync', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            jsAsync: 'lynx_common_chunks',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.filename).toMatchInlineSnapshot(
        `"static/js/[name].js"`,
      )
      expect(config.output?.chunkFilename).toMatchInlineSnapshot(
        `"lynx_common_chunks/[name].js"`,
      )
    })

    test('js with jsAsync', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          distPath: {
            js: 'common',
            jsAsync: 'lynx_common_chunks',
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.filename).toMatchInlineSnapshot(
        `"common/[name].js"`,
      )
      expect(config.output?.chunkFilename).toMatchInlineSnapshot(
        `"lynx_common_chunks/[name].js"`,
      )
    })
  })

  describe('output.filename', () => {
    test('defaults', async () => {
      const rsbuild = await createStubRspeedy({})

      await rsbuild.unwrapConfig()

      expect(rsbuild.getRspeedyConfig().output?.filename).toMatchInlineSnapshot(
        `
        {
          "bundle": "[name].[platform].bundle",
          "template": "[name].[platform].bundle",
        }
      `,
      )
    })

    test('output.filename: string', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          filename: 'static/bundle/[name].bundle',
        },
      })

      await rsbuild.unwrapConfig()

      expect(rsbuild.getRspeedyConfig().output?.filename).toMatchInlineSnapshot(
        `"static/bundle/[name].bundle"`,
      )
    })

    test('output.filename.template', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          filename: { template: 'static/bundle/[name].bundle' },
        },
      })

      await rsbuild.unwrapConfig()

      expect(rsbuild.getRspeedyConfig().output?.filename).toMatchInlineSnapshot(
        `
        {
          "bundle": "static/bundle/[name].bundle",
          "template": "static/bundle/[name].bundle",
        }
      `,
      )
    })

    test('output.filename.bundle', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          filename: { bundle: 'static/bundle/[name].bundle' },
        },
      })

      await rsbuild.unwrapConfig()

      expect(rsbuild.getRspeedyConfig().output?.filename).toMatchInlineSnapshot(
        `
        {
          "bundle": "static/bundle/[name].bundle",
          "template": "static/bundle/[name].bundle",
        }
      `,
      )
    })

    test('output.filename.bundle and output.filename.template', async () => {
      const rsbuild = await createStubRspeedy({
        output: {
          filename: { bundle: '[name].bundle', template: '[name].template' },
        },
      })

      await rsbuild.unwrapConfig()

      expect(rsbuild.getRspeedyConfig().output?.filename)
        .toMatchInlineSnapshot(`
          {
            "bundle": "[name].bundle",
            "template": "[name].template",
          }
        `)
    })
  })
})

function getAssetRules(config: Rspack.Configuration) {
  return config.module?.rules?.flatMap(isAssetRule)

  function isAssetRule(
    rule: Rspack.RuleSetRule | boolean | null | undefined | 0 | '' | '...',
  ): Rspack.RuleSetRule[] {
    if (!rule) {
      return []
    }

    if (typeof rule !== 'object') {
      return []
    }

    const oneOfRule = rule.oneOf?.filter(isAssetRule)
    if (oneOfRule) {
      return oneOfRule.filter(rule => !!rule)
    }

    if (rule.type?.includes('asset')) {
      return [rule]
    }

    return []
  }
}
