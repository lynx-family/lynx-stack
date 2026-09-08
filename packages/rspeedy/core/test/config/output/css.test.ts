// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRspeedy } from '../../createStubRspeedy.js'

function getCssExtractOptions(
  config: Rspack.Configuration,
): { filename?: string, chunkFilename?: string } {
  const plugin = config.plugins?.find(
    (plugin) => plugin?.constructor?.name === 'CssExtractRspackPlugin',
  )
  return (plugin as unknown as {
    options: { filename?: string, chunkFilename?: string }
  }).options
}

describe('output.css', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const { filename, chunkFilename } = getCssExtractOptions(
      await rspeedy.unwrapConfig(),
    )

    expect(filename).toBe('.lynx/[name]/[name].css')
    expect(chunkFilename).toBe('.lynx/async/[name]/[name].css')
  })

  test('override with plugin using modifyEnvironmentConfig', async () => {
    const rspeedy = await createStubRspeedy({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) =>
              mergeEnvironmentConfig(config, {
                output: {
                  distPath: { css: 'plugin-css' },
                  filename: { css: 'plugin/[name].css' },
                },
              })
            )
          },
        } satisfies RsbuildPlugin,
      ],
    })

    const { filename, chunkFilename } = getCssExtractOptions(
      await rspeedy.unwrapConfig(),
    )

    expect(filename).toBe('plugin-css/plugin/[name].css')
    expect(chunkFilename).toBe('plugin-css/async/plugin/[name].css')
  })

  test('override with plugin using modifyRsbuildConfig', async () => {
    const rspeedy = await createStubRspeedy({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
              mergeRsbuildConfig(config, {
                output: {
                  distPath: { css: 'plugin-css' },
                  filename: { css: 'plugin/[name].css' },
                },
              })
            )
          },
        } satisfies RsbuildPlugin,
      ],
    })

    const { filename, chunkFilename } = getCssExtractOptions(
      await rspeedy.unwrapConfig(),
    )

    expect(filename).toBe('plugin-css/plugin/[name].css')
    expect(chunkFilename).toBe('plugin-css/async/plugin/[name].css')
  })

  test('keeps the user config', async () => {
    const rspeedy = await createStubRspeedy({
      output: { filename: { css: 'user/[name].css' } },
    })

    const { filename } = getCssExtractOptions(await rspeedy.unwrapConfig())

    expect(filename).toBe('.lynx/user/[name].css')
  })

  test('an environment wins over the root', async () => {
    const rspeedy = await createStubRspeedy({
      output: { filename: { css: 'root/[name].css' } },
      environments: {
        lynx: { output: { filename: { css: 'lynx/[name].css' } } },
      },
    })

    const { filename } = getCssExtractOptions(await rspeedy.unwrapConfig())

    expect(filename).toBe('.lynx/lynx/[name].css')
  })

  test('override legalComments with plugin', async () => {
    let legalComments
    const rspeedy = await createStubRspeedy({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) =>
              mergeEnvironmentConfig(config, {
                output: { legalComments: 'linked' },
              })
            )
            api.modifyEnvironmentConfig({
              handler: (config) => {
                legalComments = config.output.legalComments
              },
              order: 'post',
            })
          },
        } satisfies RsbuildPlugin,
      ],
    })

    await rspeedy.unwrapConfig()

    expect(legalComments).toBe('linked')
  })
})
