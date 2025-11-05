// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'

import type { RsbuildInstance } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import type { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
import type {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

describe('Config', () => {
  test('alias with development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
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

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-refresh',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-refresh$',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/refresh',
    )

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/refresh$',
      expect.stringContaining(
        '/packages/react/refresh/dist/index.js'.replaceAll('/', path.sep),
      ),
    )

    expect(config.resolve.alias).toHaveProperty(
      'preact$',
      expect.stringContaining(
        '/preact/dist/preact.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat$',
      expect.stringContaining(
        '/preact/compat/dist/compat.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/debug$',
      expect.stringContaining(
        '/preact/debug/dist/debug.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/devtools$',
      expect.stringContaining(
        '/preact/devtools/dist/devtools.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/hooks$',
      expect.stringContaining(
        '/preact/hooks/dist/hooks.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/test-utils$',
      expect.stringContaining(
        '/preact/test-utils/dist/testUtils.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/jsx-runtime$',
      expect.stringContaining(
        '/preact/jsx-runtime/dist/jsxRuntime.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/jsx-dev-runtime$',
      expect.stringContaining(
        '/preact/jsx-runtime/dist/jsxRuntime.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/client$',
      expect.stringContaining(
        '/preact/compat/client.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/server$',
      expect.stringContaining(
        '/preact/compat/server.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/jsx-runtime$',
      expect.stringContaining(
        '/preact/compat/jsx-runtime.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/jsx-dev-runtime$',
      expect.stringContaining(
        '/preact/compat/jsx-dev-runtime.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'preact/compat/scheduler$',
      expect.stringContaining(
        '/preact/compat/scheduler.mjs'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store$',
      expect.stringContaining(
        '/use-sync-external-store/index.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/with-selector$',
      expect.stringContaining(
        '/use-sync-external-store/with-selector.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/shim$',
      expect.stringContaining(
        '/use-sync-external-store/index.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/shim/with-selector$',
      expect.stringContaining(
        '/use-sync-external-store/with-selector.js'.replaceAll('/', path.sep),
      ),
    )
  })

  test('alias with production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
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

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-refresh',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-refresh$',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/refresh',
    )

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react/refresh$',
    )

    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store$',
      expect.stringContaining(
        '/use-sync-external-store/index.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/with-selector$',
      expect.stringContaining(
        '/use-sync-external-store/with-selector.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/shim$',
      expect.stringContaining(
        '/use-sync-external-store/index.js'.replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'use-sync-external-store/shim/with-selector$',
      expect.stringContaining(
        '/use-sync-external-store/with-selector.js'.replaceAll('/', path.sep),
      ),
    )
  })

  test('user customized `react$` alias should work', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        resolve: {
          alias: {
            react$: 'foo',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    if (!config?.resolve?.alias) {
      expect.fail('should have config.resolve.alias')
    }

    expect(config.resolve?.alias).toHaveProperty('react$', 'foo')
  })

  test('extensionAlias with tsConfig', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
        source: {
          tsconfigPath: './tsconfig.json',
        },
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBeUndefined()
    expect(config?.resolve?.extensionAlias).toHaveProperty(
      '.js',
      ['.js', '.ts', '.tsx'],
    )
  })

  test('extensionAlias without tsConfig', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
        source: {
          tsconfigPath: '',
        },
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBeUndefined()
    expect(config?.resolve?.extensionAlias).toHaveProperty(
      '.js',
      ['.js', '.ts', '.tsx'],
    )
  })

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const getBackgroundLayerOptions = async (rsbuild: RsbuildInstance) => {
    const [config] = await rsbuild.initConfigs()

    for (const rule of config?.module?.rules ?? []) {
      if (typeof rule === 'object' && rule?.oneOf) {
        for (const oneOf of rule.oneOf) {
          if (
            oneOf && typeof oneOf === 'object' && oneOf.use
            && Array.isArray(oneOf.use)
          ) {
            for (const use of oneOf.use) {
              if (
                typeof use === 'object' && use?.options
                && typeof use.options === 'object'
                && Object.hasOwn(use.options, 'enableRemoveCSSScope')
              ) {
                return use.options
              }
            }
          }
        }
      }
    }
    return undefined
  }

  test('enableRemoveCSSScope defaults to true', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({}),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    expect(
      await getBackgroundLayerOptions(rsbuild),
    ).toMatchInlineSnapshot(`
      {
        "compat": undefined,
        "defineDCE": undefined,
        "enableRemoveCSSScope": true,
        "engineVersion": "3.2",
        "inlineSourcesContent": true,
        "isDynamicComponent": false,
      }
    `)
  })
  test('enableRemoveCSSScope can be set to undefined explicitly', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            enableRemoveCSSScope: undefined,
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    expect(
      await getBackgroundLayerOptions(rsbuild),
    ).toMatchInlineSnapshot(`
      {
        "compat": undefined,
        "defineDCE": undefined,
        "enableRemoveCSSScope": undefined,
        "engineVersion": "3.2",
        "inlineSourcesContent": true,
        "isDynamicComponent": false,
      }
    `)

    const [config] = await rsbuild.initConfigs()

    expect(
      config?.module?.rules?.find(rule =>
        rule
        && typeof rule === 'object'
        && rule.sideEffects === false
        && (rule.test as RegExp).toString() === (/\.css$/).toString()
      ),
    ).toMatchInlineSnapshot(`
      {
        "resourceQuery": {
          "and": [
            /cssId/,
          ],
        },
        "sideEffects": false,
        "test": /\\\\\\.css\\$/,
      }
    `)
  })
  test('not sideEffects: false when enableRemoveCSSScope: false', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            enableRemoveCSSScope: false,
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(
      config?.module?.rules?.find(rule =>
        rule
        && typeof rule === 'object'
        && rule.sideEffects === false
        && (rule.test as RegExp).toString() === (/\.css$/).toString()
      ),
    ).toBeUndefined()
  })

  test('not sideEffects: false when enableRemoveCSSScope: true', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            enableRemoveCSSScope: true,
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(
      config?.module?.rules?.find(rule =>
        rule
        && typeof rule === 'object'
        && rule.sideEffects === false
        && (rule.test as RegExp).toString() === (/\.css$/).toString()
      ),
    ).toBeUndefined()
  })

  test('merged rsbuild config', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
        tools: {
          rspack: {
            plugins: [
              new class TestPlugin {
                apply() {
                  // Empty test plugin
                }
              }(),
            ],
          },
        },
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBeUndefined()
    expect(
      config?.plugins?.filter(plugin =>
        plugin && plugin.constructor.name === 'TestPlugin'
      ),
    ).toHaveLength(1)
  })

  describe('Output inlineScripts', () => {
    test('defaults', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: true })
    })

    test('output.inlineScripts: false', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            inlineScripts: false,
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: false })
    })

    test('output.inlineScripts: function', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            inlineScripts: ({ name, size }) => {
              return name.includes('background') && size > 1000
            },
          },
          source: {
            entry: {
              foo: {
                import: ['./foo/index.jsx', './common.js'],
              },
              bar: './bar/index.jsx',
            },
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const LynxEncodePlugin = config?.plugins?.find((
        p,
      ): p is LynxEncodePlugin => p?.constructor.name === 'LynxEncodePlugin')

      expect(LynxEncodePlugin).toBeDefined()

      // @ts-expect-error private field
      const { inlineScripts } = LynxEncodePlugin?.options ?? {}

      expect(typeof inlineScripts).toBe('function')
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(inlineScripts?.toString()).toMatchInlineSnapshot(`
        "({ name, size }) => {
                      return name.includes("background") && size > 1e3;
                    }"
      `)

      const ReactWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      expect(ReactWebpackPlugin).toBeDefined()

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { firstScreenSyncTiming } = ReactWebpackPlugin?.options ?? {}
      expect(firstScreenSyncTiming).toBe('immediately')
    })

    test('environments.lynx.output.inlineScripts: false', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          environments: {
            lynx: {
              output: {
                inlineScripts: false,
              },
            },
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: false })
    })

    test('legacy Rspeedy version (with `output.inlineScripts` defaults to `false`)', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: true })
    })

    test('output.inlineScripts defaults to `true`, when chunkSplit strategy is `all-in-one`', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          performance: {
            chunkSplit: {
              strategy: 'all-in-one',
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: true })
    })

    test('output.inlineScripts defaults to `false`, when chunkSplit strategy is not `all-in-one`', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          performance: {
            chunkSplit: {
              strategy: 'split-by-size',
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      const encodePlugin = config?.plugins?.find(p =>
        p && p.constructor.name === 'LynxEncodePlugin'
      )

      expect(encodePlugin).toHaveProperty('options', { inlineScripts: false })
    })

    test('output.inlineScripts: function, when chunkSplit strategy is not `all-in-one`', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            inlineScripts: ({ name, size }) => {
              return name.includes('background') && size > 1000
            },
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          performance: {
            chunkSplit: {
              strategy: 'split-by-size',
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      const LynxEncodePlugin = config?.plugins?.find((
        p,
      ): p is LynxEncodePlugin => p?.constructor.name === 'LynxEncodePlugin')

      expect(LynxEncodePlugin).toBeDefined()

      // @ts-expect-error private field
      const { inlineScripts } = LynxEncodePlugin?.options ?? {}

      expect(typeof inlineScripts).toBe('function')
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(inlineScripts?.toString()).toMatchInlineSnapshot(`
        "({ name, size }) => {
                      return name.includes("background") && size > 1e3;
                    }"
      `)
    })
  })

  describe('Output Filename', () => {
    test('Defaults in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.[contenthash:8].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('Multiple entries', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              foo: './fixtures/basic.tsx',
              bar: './fixtures/basic.tsx',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "filename": ".rspeedy/bar/background.[contenthash:8].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "bar__main-thread": {
            "filename": ".rspeedy/bar/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo": {
            "filename": ".rspeedy/foo/background.[contenthash:8].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo__main-thread": {
            "filename": ".rspeedy/foo/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('Nested entries', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              'foo/bar': './fixtures/basic.tsx',
              'foo/baz': './fixtures/basic.tsx',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "foo/bar": {
            "filename": ".rspeedy/foo/bar/background.[contenthash:8].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/bar__main-thread": {
            "filename": ".rspeedy/foo/bar/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo/baz": {
            "filename": ".rspeedy/foo/baz/background.[contenthash:8].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/baz__main-thread": {
            "filename": ".rspeedy/foo/baz/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filename.js: "[name].js"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              foo: './fixtures/basic.tsx',
              bar: './fixtures/basic.tsx',
              'foo/baz': './fixtures/basic.tsx',
            },
          },
          output: {
            filename: {
              js: '[name].js',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "filename": ".rspeedy/bar/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "bar__main-thread": {
            "filename": ".rspeedy/bar/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo": {
            "filename": ".rspeedy/foo/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/baz": {
            "filename": ".rspeedy/foo/baz/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/baz__main-thread": {
            "filename": ".rspeedy/foo/baz/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo__main-thread": {
            "filename": ".rspeedy/foo/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filename.js: "[name]/[name].js"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          output: {
            filename: {
              js: '[name]/[name].js',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/main/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filename.js and output.filenameHash', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              foo: './fixtures/basic.tsx',
              bar: './fixtures/basic.tsx',
              'foo/baz': './fixtures/basic.tsx',
            },
          },
          output: {
            filename: {
              js: '[name].js',
            },
            filenameHash: true,
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "filename": ".rspeedy/bar/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "bar__main-thread": {
            "filename": ".rspeedy/bar/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo": {
            "filename": ".rspeedy/foo/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/baz": {
            "filename": ".rspeedy/foo/baz/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "foo/baz__main-thread": {
            "filename": ".rspeedy/foo/baz/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
          "foo__main-thread": {
            "filename": ".rspeedy/foo/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filenameHash: false', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          output: {
            filenameHash: false,
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with environment["lynx"].output.filenameHash: false', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          environments: {
            lynx: {
              output: {
                filenameHash: false,
              },
            },
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filenameHash: "contenthash"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          output: {
            filenameHash: 'contenthash',
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.[contenthash].js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filenameHash: ""', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          output: {
            filenameHash: '',
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('Defaults in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.js",
            "import": [
              "@lynx-js/react/refresh",
              "@lynx-js/webpack-dev-transport/client",
              "@rspack/core/hot/dev-server",
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "<WORKSPACE>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })

    test('with output.filenameHash: "contenthash" in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          output: {
            filenameHash: 'contenthash',
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "filename": ".rspeedy/main/background.[contenthash].js",
            "import": [
              "@lynx-js/react/refresh",
              "@lynx-js/webpack-dev-transport/client",
              "@rspack/core/hot/dev-server",
              "./fixtures/basic.tsx",
            ],
            "layer": "react:background",
          },
          "main__main-thread": {
            "filename": ".rspeedy/main/main-thread.js",
            "import": [
              "<WORKSPACE>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
              "./fixtures/basic.tsx",
            ],
            "layer": "react:main-thread",
          },
        }
      `)
    })
  })

  describe('Output SourceMap', () => {
    test('default', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const backgroundConfig = await getBackgroundLayerOptions(rsbuild)

      expect(backgroundConfig).toHaveProperty('inlineSourcesContent', true)
    })

    test('with output.sourceMap: true', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            sourceMap: true,
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const backgroundConfig = await getBackgroundLayerOptions(rsbuild)

      expect(backgroundConfig).toHaveProperty('inlineSourcesContent', true)
    })

    test('with output.sourceMap: false', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            sourceMap: false,
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const backgroundConfig = await getBackgroundLayerOptions(rsbuild)

      expect(backgroundConfig).toHaveProperty('inlineSourcesContent', false)
    })

    test('with output.sourceMap.js: "nosources"', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          output: {
            sourceMap: {
              js: 'nosources-source-map',
            },
          },
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const backgroundConfig = await getBackgroundLayerOptions(rsbuild)

      expect(backgroundConfig).toHaveProperty('inlineSourcesContent', false)
    })
  })

  describe('Output IIFE', () => {
    test('defaults', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      expect(config?.output?.iife).toBe(false)
    })

    test('with output.iife: false', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          tools: {
            rspack: {
              output: {
                iife: false,
              },
            },
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      expect(config?.output?.iife).toBe(false)
    })
    test('with output.iife: true', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          tools: {
            rspack: {
              output: {
                iife: true,
              },
            },
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      expect(config?.output?.iife).toBe(true)
    })
  })

  describe('Bundle Splitting', () => {
    test('default', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toBe(false)
    })

    test('performance.chunkSplit.strategy: "all-in-one"', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
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

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toBe(false)
    })

    test('performance.chunkSplit.strategy: "split-by-size"', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          performance: {
            chunkSplit: {
              strategy: 'split-by-size',
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      if (config?.optimization?.splitChunks === undefined) {
        expect.fail('should have config.optimization.splitChunks')
      }

      expect(config.optimization.splitChunks).not.toBe(false)

      if (config.optimization.splitChunks === false) {
        expect.unreachable('splitChunks is not false')
      }
      expect(config.optimization.splitChunks.cacheGroups).toStrictEqual({})
      expect(config.optimization.splitChunks).toHaveProperty('maxSize')
      expect(config.optimization.splitChunks).toHaveProperty('minSize')
    })

    test('performance.chunkSplit.strategy: "split-by-experience"', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          performance: {
            chunkSplit: {
              strategy: 'split-by-experience',
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      if (config?.optimization?.splitChunks === undefined) {
        expect.fail('should have config.optimization.splitChunks')
      }

      expect(config.optimization.splitChunks).not.toBe(false)
      expect(config.optimization.splitChunks).toHaveProperty('cacheGroups')

      if (config.optimization.splitChunks === false) {
        expect.unreachable('splitChunks is not false')
      }

      expect(config.optimization.splitChunks.cacheGroups).toHaveProperty(
        'preact',
      )
      expect(config.optimization.splitChunks.cacheGroups?.['preact'])
        .toMatchInlineSnapshot(`
          {
            "name": "lib-preact",
            "priority": 0,
            "test": /node_modules\\[\\\\\\\\/\\]\\(\\.\\*\\?\\[\\\\\\\\/\\]\\)\\?\\(\\?:preact\\|preact\\[\\\\\\\\/\\]compat\\|preact\\[\\\\\\\\/\\]hooks\\|preact\\[\\\\\\\\/\\]jsx-runtime\\)\\[\\\\\\\\/\\]/,
          }
        `)
    })

    test('performance.chunkSplit.strategy: "split-by-experience" along with extractStr: true', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      let config, ReactLynxWebpackPlugin

      let rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx({
              extractStr: true,
            }),
            pluginStubRspeedyAPI(),
          ],
          performance: {
            chunkSplit: {
              strategy: 'split-by-experience',
            },
          },
        },
      })
      ;[config] = await rsbuild.initConfigs()

      ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.extractStr).toBe(false)
      // expect(config).toMatchInlineSnapshot()

      rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx({
              extractStr: true,
            }),
            pluginStubRspeedyAPI(),
          ],
        },
      })
      ;[config] = await rsbuild.initConfigs()

      ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.extractStr).toBe(true)
      // expect(config).toMatchInlineSnapshot()

      rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx({
              extractStr: true,
            }),
            pluginStubRspeedyAPI(),
          ],
          performance: {
            chunkSplit: {
              strategy: 'all-in-one',
            },
          },
        },
      })
      ;[config] = await rsbuild.initConfigs()

      ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.extractStr).toBe(true)
      // expect(config).toMatchInlineSnapshot()
    })

    test('tools.rspack.optimization.splitChunks: false', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          tools: {
            rspack: {
              optimization: {
                splitChunks: false,
              },
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toBe(false)
    })

    test('tools.rspack.optimization.splitChunks: {}', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          performance: {
            chunkSplit: {
              strategy: 'split-by-experience',
            },
          },
          tools: {
            rspack: {
              optimization: {
                splitChunks: {},
              },
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toHaveProperty(
        'chunks',
        expect.any(Function),
      )
    })

    test('tools.rspack.optimization.splitChunks: {} without environment: "lynx"', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          performance: {
            chunkSplit: {
              strategy: 'split-by-experience',
            },
          },
          environments: {},
          tools: {
            rspack: {
              optimization: {
                splitChunks: {},
              },
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toHaveProperty(
        'chunks',
        expect.any(Function),
      )
    })

    test('tools.rspack.optimization.splitChunks: { chunks: "async" }', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
            pluginStubRspeedyAPI(),
          ],
          environments: {
            lynx: {},
          },
          tools: {
            rspack: {
              optimization: {
                splitChunks: {
                  chunks: 'async',
                },
              },
            },
          },
        },
      })

      const [config] = await rsbuild.initConfigs()

      expect(config?.optimization?.splitChunks).toHaveProperty(
        'chunks',
        'async',
      )
    })
  })

  describe('transform configs', () => {
    test('defineDCE should do DCE before bundle', async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: new URL('./fixtures/defineDCE/basic.js', import.meta.url)
                .pathname,
            },
          },
          environments: {
            lynx: {},
          },
          plugins: [
            pluginReactLynx({
              defineDCE: { define: { __SOME_MACRO__: 'false' } },
            }),
          ],
        },
      })

      try {
        await rsbuild.build()
      } catch (_error) {
        expect.fail('build should succeed')
      }
    })
  })

  test('default LynxTemplatePlugin options', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugin).toBeDefined()
    // @ts-expect-error private field
    expect(templatePlugin?.options).toMatchInlineSnapshot(`
      {
        "chunks": [
          "main__main-thread",
          "main",
        ],
        "cssPlugins": [],
        "customCSSInheritanceList": undefined,
        "debugInfoOutside": true,
        "defaultDisplayLinear": true,
        "dsl": "react_nodiff",
        "enableA11y": true,
        "enableAccessibilityElement": false,
        "enableCSSInheritance": false,
        "enableCSSInvalidation": true,
        "enableCSSSelector": true,
        "enableNewGesture": false,
        "enableRemoveCSSScope": true,
        "experimental_isLazyBundle": false,
        "filename": "main.lynx.bundle",
        "intermediate": ".rspeedy/main",
        "removeDescendantSelectorScope": true,
        "targetSdkVersion": "3.2",
      }
    `)
  })

  test('targetSdkVersion', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            targetSdkVersion: '3.3',
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugin).toBeDefined()
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.targetSdkVersion).toBe('3.3')
  })

  test('engineVersion', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            engineVersion: '3.3',
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugin).toBeDefined()
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.targetSdkVersion).toBe('3.3')
  })

  test('targetSdkVersion and engineVersion', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            targetSdkVersion: '3.3',
            engineVersion: '3.4',
          }),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugin).toBeDefined()
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.targetSdkVersion).toBe('3.4')
  })
  ;['development', 'production'].forEach(mode => {
    test(`lazyBundle on ${mode} mode`, async () => {
      vi.stubEnv('NODE_ENV', mode)

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx({
              experimental_isLazyBundle: true,
            }),
            pluginStubRspeedyAPI(),
          ],
        },
      })

      const [config] = await rsbuild.initConfigs()
      if (mode === 'development') {
        expect(config?.entry).toMatchInlineSnapshot(`
          {
            "main": {
              "filename": ".rspeedy/main/background.[contenthash:8].js",
              "import": [
                "@lynx-js/react/refresh",
                "@lynx-js/webpack-dev-transport/client",
                "@rspack/core/hot/dev-server",
                "./src/index.js",
              ],
              "layer": "react:background",
            },
            "main__main-thread": {
              "filename": ".rspeedy/main/main-thread.js",
              "import": [
                "<WORKSPACE>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
                "./src/index.js",
              ],
              "layer": "react:main-thread",
            },
          }
        `)
      } else {
        expect(config?.entry).toMatchInlineSnapshot(`
          {
            "main": {
              "filename": ".rspeedy/main/background.[contenthash:8].js",
              "import": [
                "./src/index.js",
              ],
              "layer": "react:background",
            },
            "main__main-thread": {
              "filename": ".rspeedy/main/main-thread.js",
              "import": [
                "./src/index.js",
              ],
              "layer": "react:main-thread",
            },
          }
        `)
      }

      vi.unstubAllEnvs()
    })
  })

  describe('Profile', () => {
    test('default', async () => {
      vi.stubEnv('DEBUG', '')

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      const ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.profile).toBe(undefined)
    })

    test('with mode=development', async () => {
      vi.stubEnv('DEBUG', '')

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
          ],
          mode: 'development',
        },
      })

      const [config] = await rspeedy.initConfigs()

      const ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.profile).toBe(undefined)

      vi.unstubAllEnvs()
    })

    test('with DEBUG', async () => {
      vi.stubEnv('DEBUG', 'rspeedy')

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      const ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.profile).toBe(true)
    })

    test('with performance.profile: true', async () => {
      vi.stubEnv('DEBUG', '')

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          performance: {
            profile: true,
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      const ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.profile).toBe(true)
    })

    test('with performance.profile: false', async () => {
      vi.stubEnv('DEBUG', '')

      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          performance: {
            profile: false,
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const [config] = await rspeedy.initConfigs()

      const ReactLynxWebpackPlugin = config?.plugins?.find((
        p,
      ): p is ReactWebpackPlugin =>
        p?.constructor.name === 'ReactWebpackPlugin'
      )

      // @ts-expect-error private field
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(ReactLynxWebpackPlugin?.options.profile).toBe(false)
    })
  })

  test('worklet runtime (mode: production)', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        mode: 'production',
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rspeedy.initConfigs()

    const reactWebpackPluginInstance = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin =>
      !!(p && p.constructor.name === 'ReactWebpackPlugin')
    )

    if (!reactWebpackPluginInstance) {
      expect.fail('Should have ReactWebpackPlugin instance')
    }

    // @ts-expect-error private property
    expect(reactWebpackPluginInstance.options).toHaveProperty(
      'workletRuntimePath',
      require.resolve('@lynx-js/react/worklet-runtime'),
    )
  })

  test('worklet runtime (mode: development)', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        mode: 'development',
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rspeedy.initConfigs()

    const reactWebpackPluginInstance = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin =>
      !!(p && p.constructor.name === 'ReactWebpackPlugin')
    )

    if (!reactWebpackPluginInstance) {
      expect.fail('Should have ReactWebpackPlugin instance')
    }

    // @ts-expect-error private property
    expect(reactWebpackPluginInstance.options).toHaveProperty(
      'workletRuntimePath',
      require.resolve('@lynx-js/react/worklet-dev-runtime'),
    )
  })

  test('worklet runtime (mode: none)', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        mode: 'none',
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rspeedy.initConfigs()

    const reactWebpackPluginInstance = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin =>
      !!(p && p.constructor.name === 'ReactWebpackPlugin')
    )

    if (!reactWebpackPluginInstance) {
      expect.fail('Should have ReactWebpackPlugin instance')
    }

    const require = createRequire(import.meta.url)

    // @ts-expect-error private property
    expect(reactWebpackPluginInstance.options).toHaveProperty(
      'workletRuntimePath',
      require.resolve('@lynx-js/react/worklet-runtime'),
    )
  })
})

describe('MPA Config', () => {
  test('entries', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: './foo/index.js',
            bar: './bar/index.jsx',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
      ]
    `)
  })

  test('entry[]', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: {
              import: './foo/index.jsx',
            },
            bar: ['./bar/index.jsx', './common.js'],
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
      ]
    `)
  })

  test('entry[] with environment.web', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { web: {} },
        source: {
          entry: {
            foo: {
              import: './foo/index.jsx',
            },
            bar: ['./bar/index.jsx', './common.js'],
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        "foo/main-thread.js",
        "bar/main-thread.js",
      ]
    `)
  })

  test('entry.import', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: {
              import: './foo/index.jsx',
            },
            bar: './bar/index.jsx',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
      ]
    `)
  })

  test('entry.import[]', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: {
              import: ['./foo/index.jsx', './common.js'],
            },
            bar: './bar/index.jsx',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
      ]
    `)
  })

  test('entry.dependsOn', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: {
              import: './foo/index.jsx',
              dependOn: 'bar',
            },
            bar: './bar/index.jsx',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(2)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
      ]
    `)
  })

  test('entry.dependsOn[]', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        environments: { lynx: {} },
        source: {
          entry: {
            foo: {
              import: './foo/index.jsx',
              dependOn: ['baz', 'bar'],
            },
            bar: './bar/index.jsx',
            baz: './baz/index.jsx',
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const templatePlugins = config?.plugins?.filter((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    expect(templatePlugins).toHaveLength(3)
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.filename)).toMatchInlineSnapshot(`
      [
        "foo.lynx.bundle",
        "bar.lynx.bundle",
        "baz.lynx.bundle",
      ]
    `)

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    expect(templatePlugins.map(i => i.options.chunks)).toMatchInlineSnapshot(`
      [
        [
          "foo__main-thread",
          "foo",
        ],
        [
          "bar__main-thread",
          "bar",
        ],
        [
          "baz__main-thread",
          "baz",
        ],
      ]
    `)

    const reactWebpackPlugin = config?.plugins?.find((
      p,
    ): p is ReactWebpackPlugin => p?.constructor.name === 'ReactWebpackPlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(reactWebpackPlugin.options.mainThreadChunks).toMatchInlineSnapshot(`
      [
        ".rspeedy/foo/main-thread.js",
        ".rspeedy/bar/main-thread.js",
        ".rspeedy/baz/main-thread.js",
      ]
    `)
  })

  test('default value of resolve.dedupe', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    await rspeedy.initConfigs()
    const rsbuildConfig = rspeedy.getNormalizedConfig()

    expect(rsbuildConfig.resolve?.dedupe).toMatchInlineSnapshot(`
      [
        "react-compiler-runtime",
      ]
    `)
  })
})
