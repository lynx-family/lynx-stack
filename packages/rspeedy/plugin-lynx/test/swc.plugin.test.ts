// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import { getLoaderOptions } from './getLoaderOptions.js'
import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
} from '../src/utils/getESVersionTarget.js'

describe('pluginSwc', () => {
  test('defaults', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
    expect(loaderOptions?.env?.include).toEqual([
      'transform-block-scoping',
      ...getESVersionEnvInclude(),
    ])
  })

  test('user-configured jsc.target throws (target is managed via env)', async () => {
    const rsbuild = await createStubRsbuild({
      tools: {
        swc: {
          jsc: {
            target: 'es5',
          },
        },
      },
    })

    await expect(rsbuild.unwrapConfig()).rejects.toThrowError(
      /Rspeedy manages the SWC compilation target via `env`/,
    )
  })

  test('user can opt out of transform-block-scoping via env.exclude', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      tools: {
        swc: {
          env: {
            exclude: ['transform-block-scoping'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.exclude).toEqual(['transform-block-scoping'])
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
  })

  test('user-configured env.include is merged onto the baseline', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      tools: {
        swc: {
          env: {
            include: ['transform-spread'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.include).toContain('transform-spread')
    expect(loaderOptions?.env?.include).toContain('transform-block-scoping')
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
  })

  test('modify swc config from plugin', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [
        {
          name: 'test:swc',
          setup(api: RsbuildPluginAPI) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
              return mergeRsbuildConfig(config, {
                tools: {
                  swc(config) {
                    config.minify = true
                    return config
                  },
                },
              })
            })
          },
        },
      ],
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.minify).toBe(true)
    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
    expect(loaderOptions?.env?.include).toContain('transform-block-scoping')
  })
})
