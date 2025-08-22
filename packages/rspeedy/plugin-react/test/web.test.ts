// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { WebEncodePlugin } from '@lynx-js/template-webpack-plugin'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

describe('Web', () => {
  test('should not have template plugin for web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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
      config?.plugins?.some(p => p?.constructor.name === 'LynxEncodePlugin'),
    ).toBeFalsy()
  })

  test('should not have runtime wrapper plugin for web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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
    ).toBeTruthy()

    expect(
      lynxConfig?.plugins?.some(p =>
        p?.constructor.name === 'LynxEncodePlugin'
      ),
    ).toBeTruthy()

    expect(
      webConfig?.plugins?.some(p => p?.constructor.name === 'LynxEncodePlugin'),
    ).toBeFalsy()
  })

  test('should have web plugin for web but not for lynx and others', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
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

  test('plugins with multiple environments', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/index.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: {
          lynx: {
            plugins: [
              pluginReactLynx(),
            ],
          },
          web: {
            plugins: [
              pluginReactLynx(),
            ],
          },
        },
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [lynxConfig, webConfig] = await rsbuild.initConfigs()

    if (!lynxConfig?.resolve?.alias) {
      expect.fail('lynxConfig should have config.resolve.alias')
    }

    if (!webConfig?.resolve?.alias) {
      expect.fail('webConfig should have config.resolve.alias')
    }

    expect(lynxConfig.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(webConfig.resolve.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining(
        '/packages/react/runtime/lib/internal.js'.replaceAll('/', path.sep),
      ),
    )
  })

  // TODO: stack overflow, should be fixed in the later PRs
  test.skip('alias with plugins + environments', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/index.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: {
          lynx: {
            plugins: [
              pluginReactLynx(),
            ],
          },
          web: {},
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [lynxConfig, webConfig] = await rsbuild.initConfigs()

    if (!lynxConfig?.resolve?.alias) {
      expect.fail('lynxConfig should have config.resolve.alias')
    }

    if (!webConfig?.resolve?.alias) {
      expect.fail('webConfig should have config.resolve.alias')
    }

    expect(lynxConfig.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(webConfig.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )
  })
})
