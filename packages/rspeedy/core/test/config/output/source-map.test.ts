// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NormalizedEnvironmentConfig, RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createRspeedy } from '../../../src/index.js'
import type { Config } from '../../../src/index.js'
import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('output.sourceMap', () => {
  test('does not set css source map by default', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {},
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toBeUndefined()
  })

  test('respects output.sourceMap false', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: false,
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toBe(false)
  })

  test('respects output.sourceMap.css false', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: {
            css: false,
          },
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toEqual({
      css: false,
    })
  })

  test('keeps user js source map config', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        output: {
          sourceMap: {
            js: 'source-map',
          },
        },
      },
    })

    expect(rspeedy.getRspeedyConfig().output?.sourceMap).toEqual({
      js: 'source-map',
    })
  })

  test('enables css source map for lynx by default', async () => {
    expect(await resolveSourceMap({})).toHaveProperty('css', true)
  })

  test('keeps css source map off for a non-Lynx environment', async () => {
    expect(await resolveSourceMap({ environments: { web: {} } }, 'web'))
      .toHaveProperty('css', false)
  })

  test('override css source map with modifyRsbuildConfig', async () => {
    const sourceMap = await resolveSourceMap({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
              mergeRsbuildConfig(config, {
                output: { sourceMap: { css: false } },
              })
            )
          },
        } satisfies RsbuildPlugin,
      ],
    })

    expect(sourceMap).toHaveProperty('css', false)
  })

  test('override css source map with modifyEnvironmentConfig', async () => {
    const sourceMap = await resolveSourceMap({
      plugins: [
        {
          name: 'test',
          setup(api) {
            api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) =>
              mergeEnvironmentConfig(config, {
                output: { sourceMap: { css: false } },
              })
            )
          },
        } satisfies RsbuildPlugin,
      ],
    })

    expect(sourceMap).toHaveProperty('css', false)
  })
})

async function resolveSourceMap(
  config: Config,
  environment = 'lynx',
): Promise<NormalizedEnvironmentConfig['output']['sourceMap'] | undefined> {
  let sourceMap: NormalizedEnvironmentConfig['output']['sourceMap'] | undefined

  const rspeedy = await createStubRspeedy({
    ...config,
    plugins: [
      ...config.plugins ?? [],
      {
        name: 'probe',
        setup(api) {
          api.modifyEnvironmentConfig({
            handler: (environmentConfig, { name }) => {
              if (name === environment) {
                sourceMap = environmentConfig.output.sourceMap
              }
            },
            order: 'post',
          })
        },
      } satisfies RsbuildPlugin,
    ],
  })

  await rspeedy.unwrapConfig()

  return sourceMap
}
