// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'
import type { RuleSetRule } from '@rspack/core'
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
      cwd: path.dirname(fileURLToPath(import.meta.url)),
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
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/jsx-runtime',
      expect.stringContaining(
        '/packages/react/runtime/jsx-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/jsx-dev-runtime',
      expect.stringContaining(
        '/packages/react/runtime/jsx-dev-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining(
        '/packages/react/runtime/lib/internal.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/experimental/lazy/import$',
      expect.stringContaining(
        '/packages/react/runtime/lazy/import.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/debug$',
    )

    const preactAlias = Object.fromEntries(
      Object.entries(config.resolve.alias)
        .filter(([key]) => key.startsWith('preact'))
        .map(([key, value]) => [
          key,
          typeof value === 'string'
            ? value.replaceAll(path.sep, '/').replace(/.*(preact\/.*)/, '$1')
            : value,
        ]),
    )

    expect(preactAlias).toMatchInlineSnapshot(`
      {
        "preact$": "preact/dist/preact.mjs",
        "preact/compat$": "preact/compat/dist/compat.mjs",
        "preact/compat/client$": "preact/compat/client.mjs",
        "preact/compat/jsx-dev-runtime$": "preact/compat/jsx-dev-runtime.mjs",
        "preact/compat/jsx-runtime$": "preact/compat/jsx-runtime.mjs",
        "preact/compat/scheduler$": "preact/compat/scheduler.mjs",
        "preact/compat/server$": "preact/compat/server.mjs",
        "preact/debug$": "preact/debug/dist/debug.mjs",
        "preact/devtools$": "preact/devtools/dist/devtools.mjs",
        "preact/jsx-dev-runtime$": "preact/jsx-runtime/dist/jsxRuntime.mjs",
        "preact/jsx-runtime$": "preact/jsx-runtime/dist/jsxRuntime.mjs",
        "preact/test-utils$": "preact/test-utils/dist/testUtils.mjs",
      }
    `)
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
      cwd: path.dirname(fileURLToPath(import.meta.url)),
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
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/internal$',
      expect.stringContaining(
        '/packages/react/runtime/lib/internal.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/debug$',
      false,
    )
  })

  test('layered lepus hooks alias for main thread', async () => {
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
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    const [config] = await rsbuild.initConfigs()
    if (!config?.module?.rules) {
      expect.fail('should have config.module.rules')
    }

    const mainThreadRule = config.module.rules.find((rule) => {
      if (!rule || typeof rule !== 'object') {
        return false
      }
      return rule.issuerLayer === LAYERS.MAIN_THREAD && !!rule.resolve?.alias
    }) as RuleSetRule

    if (!mainThreadRule || !mainThreadRule.resolve?.alias) {
      expect.fail('should have main-thread alias rule')
    }

    expect(mainThreadRule.resolve.alias).toHaveProperty(
      'preact/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/snapshot/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/snapshot/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/lepus/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/snapshot/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
  })

  test('layered hooks alias for background', async () => {
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
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    const [config] = await rsbuild.initConfigs()
    if (!config?.module?.rules) {
      expect.fail('should have config.module.rules')
    }

    const backgroundRule = config.module.rules.find((rule) => {
      if (!rule || typeof rule !== 'object') {
        return false
      }
      return rule.issuerLayer === LAYERS.BACKGROUND && !!rule.resolve?.alias
    }) as RuleSetRule

    if (!backgroundRule || !backgroundRule.resolve?.alias) {
      expect.fail('should have background alias rule')
    }

    expect(backgroundRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/snapshot/hooks/react.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    const preactHooks = backgroundRule.resolve.alias['preact/hooks']
    expect(
      typeof preactHooks === 'string'
        ? preactHooks.replaceAll(path.sep, '/').replace(
          /.*(preact\/.*)/,
          '$1',
        )
        : preactHooks,
    ).toBe('preact/hooks/dist/hooks.mjs')
  })

  test.skip('alias once', async () => {
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
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    await rsbuild.initConfigs()

    expect(layerGetter).toBeCalledTimes(2)
    expect.assertions(2)
  })

  describe('with environments', () => {
    test('alias with multiple environments', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { pluginReactAlias } = await import('../src/index.js')

      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: {
            lynx: {
              plugins: [
                pluginReactAlias({
                  LAYERS,
                }),
              ],
            },
            web: {
              plugins: [
                pluginReactAlias({
                  LAYERS,
                }),
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

    test('alias with plugins + environments', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { pluginReactAlias } = await import('../src/index.js')

      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: {
            lynx: {
              plugins: [
                pluginReactAlias({
                  LAYERS,
                }),
              ],
            },
            web: {},
          },
          plugins: [
            pluginReactAlias({
              LAYERS,
            }),
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
})
