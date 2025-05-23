// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { WebEncodePlugin } from '@lynx-js/template-webpack-plugin'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

describe('Web', () => {
  test('should not have template plugin for web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: {
          web: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBe(undefined)

    expect(
      config?.plugins?.some(p => p?.constructor.name === 'LynxTemplatePlugin'),
    ).toBeFalsy()
  })

  test('should not have runtime wrapper plugin for web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: {
          web: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBe(undefined)

    expect(
      config?.plugins?.some(p =>
        p?.constructor.name === 'RuntimeWrapperWebpackPlugin'
      ),
    ).toBeFalsy()
  })

  test('should have template plugin for lynx but not for web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: {
          lynx: {
            source: {
              entry: { main: 'index.js' },
            },
          },
          web: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [lynxConfig, webConfig] = await rsbuild.initConfigs()

    expect(lynxConfig).not.toBe(undefined)
    expect(webConfig).not.toBe(undefined)

    expect(
      lynxConfig?.plugins?.some(p =>
        p?.constructor.name === 'LynxTemplatePlugin'
      ),
    ).toBeTruthy()

    expect(
      webConfig?.plugins?.some(p =>
        p?.constructor.name === 'LynxTemplatePlugin'
      ),
    ).toBeFalsy()
  })

  test('should have web plugin for web but not for lynx and others', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: {
          lynx: {
            source: {
              entry: { main: 'index.js' },
            },
          },
          web: {},
          prefetch: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [lynxConfig, webConfig, prefetchConfig] = await rsbuild.initConfigs()

    expect(lynxConfig).not.toBe(undefined)
    expect(webConfig).not.toBe(undefined)

    expect(
      lynxConfig?.plugins?.some(p =>
        p?.constructor.name === WebEncodePlugin.name
      ),
    ).toBeFalsy()

    expect(
      webConfig?.plugins?.some(p =>
        p?.constructor.name === WebEncodePlugin.name
      ),
    ).toBeTruthy()

    expect(
      prefetchConfig?.plugins?.some(p =>
        p?.constructor.name === WebEncodePlugin.name
      ),
    ).toBeFalsy()
  })

  test('all-in-one-public-path-not-auto', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: new URL('./fixtures/basic.tsx', import.meta.url).pathname,
          },
        },
        tools: {
          swc(config) {
            delete config.env
            return config
          },
        },
        environments: {
          web: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
        performance: {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
      },
    })
    await rsbuild.build()
    const { web: config } = rsbuild.getNormalizedConfig().environments
    expect(
      typeof config?.tools.rspack === 'object'
        && !Array.isArray(config?.tools.rspack)
        ? config.tools.rspack.output?.publicPath
        : undefined,
    ).not.toBe('auto')
  })

  test('should have two bundle for lynx and web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: new URL('./fixtures/basic.tsx', import.meta.url).pathname,
          },
        },
        tools: {
          swc(config) {
            delete config.env
            return config
          },
        },
        environments: {
          web: {},
          lynx: {},
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
        performance: {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
      },
    })

    const [webConfig, lynxConfig] = await rsbuild.initConfigs()

    expect(
      webConfig?.plugins?.find((
        p,
      ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin' // @ts-expect-error private field
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      )?.options?.filename,
    ).toMatchInlineSnapshot('"main.web.bundle"')
    expect(
      lynxConfig?.plugins?.find((
        p,
      ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin' // @ts-expect-error private field
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      )?.options?.filename,
    ).toMatchInlineSnapshot('"main.lynx.bundle"')
  })
})
