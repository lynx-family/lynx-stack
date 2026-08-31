// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildConfig, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

interface MinimizerLike {
  constructor: { name: string }
  _args: [Rspack.SwcJsMinimizerRspackPluginOptions]
}

const findJsMinimizers = (config: Rspack.Configuration) =>
  ((config.optimization?.minimizer ?? []) as unknown[]).filter(
    (m): m is MinimizerLike =>
      typeof m === 'object' && m !== null
      && m.constructor.name === 'SwcJsMinimizerRspackPlugin',
  )

describe('pluginMinify', () => {
  test('defaults', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const minimizers = findJsMinimizers(config)
    expect(minimizers).toHaveLength(1)

    const options = minimizers[0]?._args[0]?.minimizerOptions

    expect(options?.compress).toMatchObject({
      negate_iife: false,
      join_vars: false,
      ecma: 2015,
      inline: 2,
      comparisons: false,
      toplevel: true,
      side_effects: false,
    })
    expect(options?.mangle).toMatchObject({ toplevel: true })
    expect(options?.format).toMatchObject({
      keep_quoted_props: true,
      comments: false,
    })
  })

  test('keeps function and class names when REACT_DEVTOOL is set', async () => {
    rstest.stubEnv('REACT_DEVTOOL', '1')
    try {
      const rsbuild = await createStubRsbuild({ mode: 'production' })
      const config = await rsbuild.unwrapConfig({ action: 'build' })

      const options = findJsMinimizers(config)[0]?._args[0]?.minimizerOptions

      // Devtools resolves component names from `type.name` and matches
      // minified stack frames by function name.
      expect(options?.compress).toMatchObject({
        keep_fnames: true,
        keep_classnames: true,
      })
      expect(options?.mangle).toMatchObject({
        keep_fnames: true,
        keep_classnames: true,
      })
    } finally {
      rstest.unstubAllEnvs()
    }
  })

  test('does not keep names when REACT_DEVTOOL is unset', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const options = findJsMinimizers(config)[0]?._args[0]?.minimizerOptions

    expect(options?.compress).not.toHaveProperty('keep_fnames')
    expect(options?.mangle).not.toHaveProperty('keep_fnames')
  })

  test('output.minify: false disables minification', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: { minify: false },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(config.optimization?.minimize).toBe(false)
  })

  test('user jsOptions are merged onto the Lynx defaults', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: {
        minify: {
          jsOptions: {
            minimizerOptions: {
              compress: { pure_funcs: ['console.log'] },
            },
          },
        },
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const minimizers = findJsMinimizers(config)
    expect(minimizers).toHaveLength(1)

    const options = minimizers[0]?._args[0]?.minimizerOptions
    const compress = options?.compress as Record<string, unknown>

    expect(compress['pure_funcs']).toEqual(['console.log'])
    expect(compress['negate_iife']).toBe(false)
    expect(compress['toplevel']).toBe(true)
  })

  test('thread-specific js minimizers', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: {
        minify: {
          mainThreadOptions: {
            minimizerOptions: {
              compress: { pure_funcs: ['lynx.getJSModule'] },
            },
          },
          backgroundOptions: {
            minimizerOptions: {
              compress: { pure_funcs: ['lynx.registerDataProcessors'] },
            },
          },
        } as NonNullable<NonNullable<RsbuildConfig['output']>['minify']>,
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const minimizers = findJsMinimizers(config)
    expect(minimizers.length).toBe(3)

    const serialized = JSON.stringify(
      minimizers.map((minimizer) => minimizer._args[0]),
    )
    expect(serialized).toContain('lynx.getJSModule')
    expect(serialized).toContain('lynx.registerDataProcessors')

    const mainThreadPattern = /.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$/
    const backgroundPattern = /.*background(?:\.[A-Fa-f0-9]*)?\.js$/
    const [defaultOptions, mainThreadOptions, backgroundOptions] = minimizers
      .map((minimizer) => minimizer._args[0])

    expect(defaultOptions?.exclude).toEqual(
      expect.arrayContaining([mainThreadPattern, backgroundPattern]),
    )
    expect(mainThreadOptions?.include).toEqual([mainThreadPattern])
    expect(backgroundOptions?.include).toEqual([backgroundPattern])
  })

  test('thread options from the Lynx options', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' }, undefined, {
      output: {
        minify: {
          mainThreadOptions: {
            minimizerOptions: {
              compress: { pure_funcs: ['from.lynx-config'] },
            },
          },
        },
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const minimizers = findJsMinimizers(config)
    expect(minimizers.length).toBe(3)
    expect(
      JSON.stringify(minimizers.map((minimizer) => minimizer._args[0])),
    ).toContain('from.lynx-config')
  })

  test('merges the Rsbuild-config thread options with the Lynx options', async () => {
    const rsbuild = await createStubRsbuild(
      {
        mode: 'production',
        output: {
          minify: {
            mainThreadOptions: {
              minimizerOptions: {
                compress: { pure_funcs: ['from.rsbuild-config'] },
              },
            },
          } as NonNullable<NonNullable<RsbuildConfig['output']>['minify']>,
        },
      },
      undefined,
      {
        output: {
          minify: {
            mainThreadOptions: {
              minimizerOptions: {
                compress: { pure_funcs: ['from.lynx-config'] },
              },
            },
          },
        },
      },
    )
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    const serialized = JSON.stringify(
      findJsMinimizers(config).map((minimizer) => minimizer._args[0]),
    )
    expect(serialized).toContain('from.rsbuild-config')
    expect(serialized).toContain('from.lynx-config')
  })
})
