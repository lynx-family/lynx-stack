// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

describe('React - alias', () => {
  test('alias with development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactAlias } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    if (!config?.resolve?.alias) {
      expect.fail('should have config.resolve.alias')
    }

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/internal',
    )

    expect(config.resolve.alias).toHaveProperty(
      'react$',
      expect.stringContaining('/packages/react/runtime/lib/index.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining('/packages/react/runtime/lib/index.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining('/packages/react/runtime/lib/internal.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/experimental/lazy/import$',
      expect.stringContaining('/packages/react/runtime/lazy/import.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      'preact$',
      expect.stringContaining('/preact/dist/preact.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat$',
      expect.stringContaining('/preact/compat/dist/compat.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/debug$',
      expect.stringContaining('/preact/debug/dist/debug.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/devtools$',
      expect.stringContaining('/preact/devtools/dist/devtools.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/hooks$',
      expect.stringContaining('/preact/hooks/dist/hooks.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/test-utils$',
      expect.stringContaining('/preact/test-utils/dist/testUtils.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/jsx-runtime$',
      expect.stringContaining('/preact/jsx-runtime/dist/jsxRuntime.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/jsx-dev-runtime$',
      expect.stringContaining(
        '/preact/jsx-runtime/dist/jsxRuntime.mjs',
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/client$',
      expect.stringContaining('/preact/compat/client.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/server$',
      expect.stringContaining('/preact/compat/server.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/jsx-runtime$',
      expect.stringContaining('/preact/compat/jsx-runtime.mjs'),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/jsx-dev-runtime$',
      expect.stringContaining(
        '/preact/compat/jsx-dev-runtime.mjs',
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/scheduler$',
      expect.stringContaining('/preact/compat/scheduler.mjs'),
    )
  })

  test('alias with production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactAlias } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    if (!config?.resolve?.alias) {
      expect.fail('should have config.resolve.alias')
    }

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/internal',
    )

    expect(config.resolve.alias).toHaveProperty(
      'react$',
      expect.stringContaining('/packages/react/runtime/lib/index.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining('/packages/react/runtime/lib/index.js'),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining('/packages/react/runtime/lib/internal.js'),
    )
  })

  test('alias once', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactAlias } = await import('../src/index.js')

    const layerGetter = vi.fn()

    const LAYERS = {
      get MAIN_THREAD() {
        layerGetter()
        return 'main-thread'
      },
      get BACKGROUND() {
        layerGetter()
        return 'background'
      },
    }

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
          pluginReactAlias({
            LAYERS,
          }),
          {
            name: 'test',
            setup(api) {
              return pluginReactAlias({ LAYERS }).setup(api)
            },
          } satisfies RsbuildPlugin,
          {
            name: 'test2',
            setup(api) {
              expect(api.useExposed(Symbol.for('@lynx-js/plugin-react-alias')))
                .toBe(true)
            },
          } satisfies RsbuildPlugin,
        ],
      },
    })

    await rsbuild.initConfigs()

    expect(layerGetter).toBeCalledTimes(2)
    expect.assertions(2)
  })
})
