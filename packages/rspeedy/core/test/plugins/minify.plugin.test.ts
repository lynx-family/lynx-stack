// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable vitest/expect-expect */

import {
  CssMinimizerWebpackPlugin,
  pluginCssMinimizer,
} from '@rsbuild/plugin-css-minimizer'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Output } from '../../src/index.js'
import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Plugins - Minify', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    return () => vi.unstubAllEnvs()
  })

  test('defaults', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.optimization?.minimizer).toMatchSnapshot()
  })

  test('minify: false', async () => {
    const rsbuild = await createStubRspeedy({
      output: { minify: false },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.optimization?.minimizer).toMatchInlineSnapshot(`undefined`)
  })

  test('minify.compress', async () => {
    const options: Output['minify'][] = [
      { jsOptions: { minimizerOptions: { compress: true } } },
      { jsOptions: { minimizerOptions: { compress: false } } },
      {
        jsOptions: {
          minimizerOptions: {
            compress: {
              expression: false,
              inline: 1,
              pure_funcs: [],
              negate_iife: true,
              dead_code: true,
            },
          },
        },
      },
    ]
    await options.reduce(
      (prev, curr) => prev.then(() => expectMinify(curr)),
      Promise.resolve(),
    )
  })

  test('minify.mangle', async () => {
    const options: Output['minify'][] = [
      { jsOptions: { minimizerOptions: { mangle: true } } },
      { jsOptions: { minimizerOptions: { mangle: false } } },
      {
        jsOptions: {
          minimizerOptions: {
            mangle: {
              props: {},
              toplevel: true,
              reserved: ['foo', 'lynx'],
            },
          },
        },
      },
    ]
    await options.reduce(
      (prev, curr) => prev.then(() => expectMinify(curr)),
      Promise.resolve(),
    )
  })

  test('minify.format', async () => {
    const options: Output['minify'][] = [
      { jsOptions: { minimizerOptions: { format: {} } } },
      {
        jsOptions: {
          minimizerOptions: {
            format: {
              ascii_only: true,
              asciiOnly: false,
              preserve_annotations: true,
            },
          },
        },
      },
    ]

    await options.reduce(
      (prev, curr) => prev.then(() => expectMinify(curr)),
      Promise.resolve(),
    )
  })

  test('minify.extractComments', async () => {
    const options: Output['minify'][] = [
      { jsOptions: { extractComments: {} } },
      { jsOptions: { extractComments: false } },
      { jsOptions: { extractComments: /@license/ } },
      {
        jsOptions: {
          extractComments: {
            condition: /^@keep/,
            banner: 'foo',
          },
        },
      },
      {
        jsOptions: {
          extractComments: {
            condition: false,
            banner: false,
          },
        },
      },
    ]

    await options.reduce(
      (prev, curr) => prev.then(() => expectMinify(curr)),
      Promise.resolve(),
    )
  })

  test('minify.thread-specific js minimizers', async () => {
    const rsbuild = await createStubRspeedy({
      output: {
        minify: {
          jsOptions: {
            minimizerOptions: {
              compress: {
                pure_funcs: ['console.log'],
              },
            },
          },
          mainThreadOptions: {
            minimizerOptions: {
              compress: {
                pure_funcs: ['lynx.getJSModule'],
              },
            },
          },
          backgroundOptions: {
            minimizerOptions: {
              compress: {
                pure_funcs: ['lynx.registerDataProcessors'],
              },
            },
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    expect(config.optimization?.minimizer).toMatchSnapshot()
  })

  describe('CSS', () => {
    test('css: false', async () => {
      const rsbuild = await createStubRspeedy({
        output: { minify: { css: false } },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.optimization?.minimizer).toHaveLength(1)
    })

    test('custom css minimizer', async () => {
      const rsbuild = await createStubRspeedy({
        plugins: [
          pluginCssMinimizer({
            pluginOptions: {
              minify: CssMinimizerWebpackPlugin.cleanCssMinify,
              minimizerOptions: {
                // @ts-expect-error mock
                level: {
                  1: {
                    roundingPrecision: 'all=3,px=5',
                  },
                },
              },
            },
          }),
        ],
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.optimization?.minimizer).toMatchSnapshot()
    })
  })
})

async function expectMinify(minify: Output['minify']): Promise<void> {
  const rsbuild = await createStubRspeedy({ output: { minify } })
  const config = await rsbuild.unwrapConfig()
  expect(config.optimization?.minimizer).toMatchSnapshot()
}
