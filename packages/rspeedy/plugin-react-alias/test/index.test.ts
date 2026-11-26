// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'
import type { RuleSetRule } from '@rspack/core'
import { afterEach, describe, expect, rstest, test } from '@rstest/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

async function withPatchedReactPeer(
  prefix: string,
  mutateExports: (exportsField: Record<string, unknown>) => void,
  run: (ctx: { tmpDir: string, fakeReactDir: string }) => Promise<void>,
) {
  const require = createRequire(import.meta.url)
  const realReactPkgPath = require.resolve('@lynx-js/react/package.json')
  const realReactDir = path.dirname(realReactPkgPath)
  const realPreactDir = path.dirname(
    createRequire(realReactPkgPath).resolve('preact/package.json'),
  )
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    const fakeReactDir = path.join(
      tmpDir,
      'node_modules',
      '@lynx-js',
      'react',
    )
    fs.mkdirSync(path.join(fakeReactDir, 'node_modules'), { recursive: true })

    const pkg = JSON.parse(
      fs.readFileSync(realReactPkgPath, 'utf8'),
    ) as { exports?: Record<string, unknown> }
    if (pkg.exports) {
      mutateExports(pkg.exports)
    }
    fs.writeFileSync(
      path.join(fakeReactDir, 'package.json'),
      JSON.stringify(pkg, null, 2),
    )

    const dirSymlinkType = process.platform === 'win32' ? 'junction' : 'dir'
    for (
      const entry of fs.readdirSync(realReactDir, { withFileTypes: true })
    ) {
      if (entry.name === 'package.json' || entry.name === 'node_modules') {
        continue
      }
      if (entry.isDirectory()) {
        fs.symlinkSync(
          path.join(realReactDir, entry.name),
          path.join(fakeReactDir, entry.name),
          dirSymlinkType,
        )
      } else if (entry.isFile()) {
        fs.copyFileSync(
          path.join(realReactDir, entry.name),
          path.join(fakeReactDir, entry.name),
        )
      }
    }
    fs.symlinkSync(
      realPreactDir,
      path.join(fakeReactDir, 'node_modules', 'preact'),
      dirSymlinkType,
    )

    await run({ tmpDir, fakeReactDir })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

describe('React - alias', () => {
  // Guarantee env stubs (e.g. NODE_ENV / REACT_DEVTOOL) never leak between
  // tests, even if an assertion throws before an in-body cleanup would run.
  afterEach(() => {
    rstest.unstubAllEnvs()
  })

  test('alias with development', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
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

    expect(config.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-signals$',
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
    rstest.stubEnv('NODE_ENV', 'production')
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

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/preact-devtools$',
      false,
    )
  })

  test('REACT_DEVTOOL=true keeps preact devtools in production', async () => {
    rstest.stubEnv('NODE_ENV', 'production')
    rstest.stubEnv('REACT_DEVTOOL', 'true')
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

    // `@lynx-js/react/debug` is dev-only, so it is still stripped in prod.
    expect(config.resolve.alias).toHaveProperty('@lynx-js/react/debug$', false)
    // A user-imported preact devtools is no longer aliased away.
    expect(config.resolve.alias).not.toHaveProperty('@lynx-js/preact-devtools$')
  })

  test('element-template aliases bare React, Lepus, JSX runtimes, and lazy import to ET', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactAlias } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
            elementTemplate: true,
          }),
        ],
      },
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    const [config] = await rsbuild.initConfigs()

    if (!config?.resolve?.alias) {
      expect.fail('should have config.resolve.alias')
    }

    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lib/element-template/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      'react$',
      Reflect.get(config.resolve.alias, '@lynx-js/react$'),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/lepus$',
      Reflect.get(config.resolve.alias, '@lynx-js/react$'),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/legacy-react-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/lib/core/compat/legacy-react-runtime.js'
          .replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/experimental/lazy/import$',
      expect.stringContaining(
        '/packages/react/runtime/lazy/element-template-import.js'
          .replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/experimental/lazy/import$',
      expect.stringContaining(
        '/packages/react/runtime/lazy/element-template-import.js'
          .replaceAll('/', path.sep),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/jsx-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(config.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-dev-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/jsx-dev-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )

    if (!config.module?.rules) {
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
      '@lynx-js/react/lepus$',
      expect.stringContaining(
        '/packages/react/runtime/lib/element-template/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/lib/element-template/jsx-runtime/index.js'
          .replaceAll('/', path.sep),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-dev-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/lib/element-template/jsx-dev-runtime/index.js'
          .replaceAll('/', path.sep),
      ),
    )

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
      '@lynx-js/react/lepus$',
      expect.stringContaining(
        '/packages/react/runtime/lib/element-template/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(backgroundRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/jsx-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(backgroundRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/element-template/jsx-dev-runtime$',
      expect.stringContaining(
        '/packages/react/runtime/jsx-dev-runtime/index.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
  })

  test('reads elementTemplate and lazy options when bundler chain runs', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactAlias } = await import('../src/index.js')
    const state = { elementTemplate: false, lazy: false }

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
            get elementTemplate() {
              return state.elementTemplate
            },
            get lazy() {
              return state.lazy
            },
          }),
          {
            name: 'test:late-enable-et',
            setup() {
              state.elementTemplate = true
              state.lazy = true
            },
          },
        ],
      },
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    const [config] = await rsbuild.initConfigs()

    expect(config?.resolve?.alias).toHaveProperty(
      '@lynx-js/react$',
      expect.stringContaining(
        '/packages/react/runtime/lazy/element-template.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(config?.resolve?.alias).toHaveProperty(
      '@lynx-js/react/element-template/internal$',
      expect.stringContaining(
        '/packages/react/runtime/lazy/element-template-internal.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
  })

  test('falls back to runtime/lazy/element-template-import.js for older @lynx-js/react peers', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactAlias } = await import('../src/index.js')

    await withPatchedReactPeer(
      'plugin-react-alias-legacy-peer-',
      (exportsField) => {
        delete exportsField['./element-template/experimental/lazy/import']
      },
      async ({ tmpDir, fakeReactDir }) => {
        const rsbuild = await createRsbuild({
          rsbuildConfig: {
            plugins: [
              pluginReactAlias({
                LAYERS,
                elementTemplate: true,
                rootPath: tmpDir,
              }),
            ],
          },
          cwd: tmpDir,
        })

        const [config] = await rsbuild.initConfigs()
        const expectedLazyImport = path.join(
          fs.realpathSync(fakeReactDir),
          'runtime/lazy/element-template-import.js',
        )

        expect(config?.resolve?.alias).toHaveProperty(
          '@lynx-js/react/experimental/lazy/import$',
          expectedLazyImport,
        )
        expect(config?.resolve?.alias).toHaveProperty(
          '@lynx-js/react/element-template/experimental/lazy/import$',
          expectedLazyImport,
        )
      },
    )
  })

  test('fails fast when @lynx-js/react declares the ET lazy-import export but its target is missing', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactAlias } = await import('../src/index.js')

    await withPatchedReactPeer(
      'plugin-react-alias-broken-export-',
      (exportsField) => {
        exportsField['./element-template/experimental/lazy/import'] = {
          import: './runtime/lazy/missing-element-template-import.js',
        }
      },
      async ({ tmpDir }) => {
        const rsbuild = await createRsbuild({
          rsbuildConfig: {
            plugins: [
              pluginReactAlias({
                LAYERS,
                elementTemplate: true,
                rootPath: tmpDir,
              }),
            ],
          },
          cwd: tmpDir,
        })

        await expect(rsbuild.initConfigs()).rejects.toThrow()
      },
    )
  })

  test('layered lepus hooks alias for main thread', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
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
        '/packages/react/runtime/lib/core/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/core/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react/lepus/hooks',
      expect.stringContaining(
        '/packages/react/runtime/lib/core/hooks/mainThread.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(mainThreadRule.resolve.alias).toHaveProperty(
      '@lynx-js/react-signals$',
      '@lynx-js/react-signals/lepus',
    )
  })

  test('layered hooks alias for background', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
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
        '/packages/react/runtime/lib/core/hooks/react.js'.replaceAll(
          '/',
          path.sep,
        ),
      ),
    )
    expect(backgroundRule.resolve.alias).not.toHaveProperty(
      '@lynx-js/react-signals$',
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

  test.each([false, true])(
    'alias worklet-runtime init to the published module entry (lazy: %s)',
    async (lazy) => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { pluginReactAlias } = await import('../src/index.js')

      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          plugins: [
            pluginReactAlias({
              LAYERS,
              lazy,
            }),
          ],
        },
        cwd: path.dirname(fileURLToPath(import.meta.url)),
      })

      const [config] = await rsbuild.initConfigs()

      if (!config?.resolve?.alias) {
        expect.fail('should have config.resolve.alias')
      }

      const initPath = createRequire(import.meta.url).resolve(
        '@lynx-js/react/worklet-runtime/init',
      )
      expect(
        config.resolve.alias['@lynx-js/react/worklet-runtime/init$'],
      ).toBe(initPath)
    },
  )

  test('applies aliases once per bundler chain', async () => {
    rstest.stubEnv('NODE_ENV', 'production')
    const { pluginReactAlias } = await import('../src/index.js')

    const layerGetter = rstest.fn()

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
        ],
      },
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })

    const [firstConfig] = await rsbuild.initConfigs()
    const [secondConfig] = await rsbuild.initConfigs()

    for (const config of [firstConfig, secondConfig]) {
      if (!config?.resolve?.alias) {
        expect.fail('should have config.resolve.alias')
      }

      expect(config.resolve.alias).toHaveProperty(
        '@lynx-js/react$',
        expect.stringContaining(
          '/packages/react/runtime/lib/index.js'.replaceAll('/', path.sep),
        ),
      )
    }

    expect(layerGetter).toBeCalledTimes(8)
  })

  describe('with environments', () => {
    test('alias with multiple environments', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
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
      rstest.stubEnv('NODE_ENV', 'development')
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
