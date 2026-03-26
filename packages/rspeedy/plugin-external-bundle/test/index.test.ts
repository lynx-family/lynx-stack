// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import type { ExternalsLoadingPluginOptions } from '@lynx-js/externals-loading-webpack-plugin'
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin'

import { pluginStubLayers } from './stub-layers.plugin.js'

class MockResponse extends Writable {
  headers = new Map<string, string>()

  override _write(
    _chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    callback()
  }

  setHeader(name: string, value: string): void {
    this.headers.set(name, value)
  }
}

function getExternalsLoadingPlugin(
  plugins: unknown[],
): ExternalsLoadingPlugin {
  const plugin = plugins.find(
    (value): value is ExternalsLoadingPlugin =>
      value instanceof ExternalsLoadingPlugin,
  )

  expect(plugin).toBeDefined()
  return plugin!
}

function getExternalsLoadingPluginOptions(
  plugin: ExternalsLoadingPlugin,
): ExternalsLoadingPluginOptions {
  return (plugin as unknown as {
    options: ExternalsLoadingPluginOptions
  }).options
}

type Middleware = (
  req: IncomingMessage & { url?: string },
  res: ServerResponse,
  next: () => void,
) => void

type SetupMiddlewares = (middlewares: Middleware[]) => Middleware[]

describe('pluginExternalBundle', () => {
  test('should register ExternalsLoadingPlugin with correct options', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const externalsConfig = {
      lodash: {
        bundlePath: 'lodash.lynx.bundle',
        background: { sectionPath: 'background' },
        mainThread: { sectionPath: 'mainThread' },
      },
      react: {
        bundlePath: 'react.lynx.bundle',
        background: { sectionPath: 'react-background' },
        mainThread: { sectionPath: 'react-main' },
      },
    }

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        dev: {
          assetPrefix: 'http://example.com/assets/',
        },
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            // Capture plugins for verification
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: externalsConfig,
          }),
        ],
      },
    })

    // Trigger the config to be resolved
    await rsbuild.inspectConfig()

    // Verify that ExternalsLoadingPlugin is registered
    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)

    // Verify plugin options
    expect(externalBundlePlugin).toMatchObject({
      options: {
        backgroundLayer: 'BACKGROUND_LAYER',
        mainThreadLayer: 'MAIN_THREAD_LAYER',
        externals: {
          lodash: {
            background: { sectionPath: 'background' },
            mainThread: { sectionPath: 'mainThread' },
            bundlePath: 'lodash.lynx.bundle',
          },
          react: {
            background: { sectionPath: 'react-background' },
            mainThread: { sectionPath: 'react-main' },
            bundlePath: 'react.lynx.bundle',
          },
        },
      },
    })
  })

  test('should expand string shorthand externals config', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: {
              './App.js': 'comp-lib.template.js',
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    expect(externalBundlePlugin).toMatchObject({
      options: {
        externals: {
          './App.js': {
            libraryName: './App.js',
            bundlePath: 'comp-lib.template.js',
            background: { sectionPath: './App.js' },
            mainThread: { sectionPath: './App.js__main-thread' },
            async: true,
          },
        },
      },
    })
  })

  test('should throw error if LAYERS is not exposed', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        plugins: [
          // Not including pluginStubLayers to test error case
          pluginExternalBundle({
            externals: {
              lodash: {
                bundlePath: 'lodash.lynx.bundle',
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
          }),
        ],
      },
    })

    // The error should be thrown during config inspection/build
    await expect(rsbuild.inspectConfig()).rejects.toThrow(
      'external-bundle-rsbuild-plugin requires exposed `LAYERS`. Please install a DSL plugin, for example `pluginReactLynx` for ReactLynx.',
    )
  })

  test('should work with empty externals config', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [pluginStubLayers(), pluginExternalBundle({ externals: {} })],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )

    expect(externalBundlePlugin).toBeDefined()
    expect(externalBundlePlugin).toMatchObject({
      options: {
        externals: {},
      },
    })
  })

  test('should throw when an external is missing both url and bundlePath', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: {
              lodash: {
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
          }),
        ],
      },
    })

    await expect(rsbuild.inspectConfig()).rejects.toThrow(
      'external-bundle-rsbuild-plugin requires `url` or `bundlePath` for external "lodash".',
    )
  })

  test('should expand the reactlynx preset with the normalized asset prefix', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        dev: {
          assetPrefix: 'http://example.com/assets/',
        },
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externalsPresets: {
              reactlynx: true,
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    const externals = getExternalsLoadingPluginOptions(externalBundlePlugin)
      .externals

    expect(externals?.['@lynx-js/react']).toMatchObject({
      libraryName: ['ReactLynx', 'React'],
      bundlePath: 'react.lynx.bundle',
      background: { sectionPath: 'ReactLynx' },
      mainThread: { sectionPath: 'ReactLynx__main-thread' },
      async: false,
    })
    expect(rsbuild.getNormalizedConfig().dev?.setupMiddlewares).toHaveLength(1)
  })

  test('should keep reactlynx preset as bundlePath when assetPrefix contains placeholders', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        dev: {
          assetPrefix: 'http://100.82.226.164:<port>/',
        },
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externalsPresets: {
              reactlynx: true,
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    const reactExternal = getExternalsLoadingPluginOptions(externalBundlePlugin)
      .externals?.['@lynx-js/react']
    expect(reactExternal?.bundlePath).toBe('react.lynx.bundle')
  })

  test('should emit the reactlynx bundle into build output by default', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const distRoot = mkdtempSync(path.join(tmpdir(), 'rspeedy-externals-'))
    const projectRoot = mkdtempSync(
      path.join(tmpdir(), 'rspeedy-externals-src-'),
    )
    const entryFile = path.join(projectRoot, 'index.js')
    writeFileSync(entryFile, 'console.log("external bundle test");')

    try {
      const rsbuild = await createRsbuild({
        cwd: __dirname,
        rsbuildConfig: {
          output: {
            distPath: {
              root: distRoot,
            },
          },
          source: {
            entry: {
              main: entryFile,
            },
          },
          plugins: [
            pluginStubLayers(),
            pluginExternalBundle({
              externalsPresets: {
                reactlynx: true,
              },
            }),
          ],
        },
      })

      await rsbuild.build()

      const bundleFile = path.join(distRoot, 'react.lynx.bundle')
      expect(existsSync(bundleFile)).toBe(true)
      expect(readFileSync(bundleFile).length).toBeGreaterThan(0)
    } finally {
      rmSync(distRoot, { recursive: true, force: true })
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  test('should let an explicit preset url override the automatic reactlynx url', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        dev: {
          assetPrefix: 'http://example.com/assets/',
        },
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externalsPresets: {
              reactlynx: {
                url: 'https://cdn.example.com/react.lynx.bundle',
              },
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    const externals = getExternalsLoadingPluginOptions(externalBundlePlugin)
      .externals

    expect(externals?.['@lynx-js/react']).toMatchObject({
      url: 'https://cdn.example.com/react.lynx.bundle',
    })
    expect(rsbuild.getNormalizedConfig().dev?.setupMiddlewares).toBeUndefined()
  })

  test('should allow custom externals presets from plugin options', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externalsPresets: {
              lynxUi: true,
            },
            externalsPresetDefinitions: {
              lynxUi: {
                resolveExternals() {
                  return {
                    '@lynx-js/lynx-ui': {
                      libraryName: ['LynxUI', 'UI'],
                      bundlePath: 'lynx-ui.lynx.bundle',
                      background: { sectionPath: 'LynxUI' },
                      mainThread: { sectionPath: 'LynxUI__main-thread' },
                      async: false,
                    },
                  }
                },
              },
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    const externals = getExternalsLoadingPluginOptions(externalBundlePlugin)
      .externals

    expect(externals?.['@lynx-js/lynx-ui']).toMatchObject({
      libraryName: ['LynxUI', 'UI'],
      bundlePath: 'lynx-ui.lynx.bundle',
      background: { sectionPath: 'LynxUI' },
      mainThread: { sectionPath: 'LynxUI__main-thread' },
      async: false,
    })
  })

  test('should resolve explicit external bundle paths against assetPrefix', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        dev: {
          assetPrefix: 'http://example.com/assets/',
        },
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: {
              './App.js': {
                bundlePath: '/comp-lib.lynx.bundle',
                libraryName: 'CompLib',
                background: { sectionPath: 'CompLib' },
                mainThread: { sectionPath: 'CompLib__main-thread' },
                async: true,
              },
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = getExternalsLoadingPlugin(capturedPlugins)
    const externals = getExternalsLoadingPluginOptions(externalBundlePlugin)
      .externals

    expect(externals?.['./App.js']).toMatchObject({
      bundlePath: '/comp-lib.lynx.bundle',
    })
    expect(rsbuild.getNormalizedConfig().dev?.setupMiddlewares).toHaveLength(1)
  })

  test('should serve explicit bundlePath files from externalBundleRoot', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const tempRoot = mkdtempSync(
      path.join(process.cwd(), '.tmp-plugin-external-bundle-'),
    )
    const bundlePath = 'nested/comp-lib.lynx.bundle'
    const bundleFile = path.join(tempRoot, bundlePath)

    mkdirSync(path.dirname(bundleFile), { recursive: true })
    writeFileSync(bundleFile, 'bundle')

    try {
      const rsbuild = await createRsbuild({
        cwd: __dirname,
        rsbuildConfig: {
          source: {
            entry: {
              main: './fixtures/basic.tsx',
            },
          },
          plugins: [
            pluginStubLayers(),
            pluginExternalBundle({
              externalBundleRoot: tempRoot,
              externals: {
                './App.js': {
                  bundlePath,
                  libraryName: 'CompLib',
                  background: { sectionPath: 'CompLib' },
                  mainThread: { sectionPath: 'CompLib__main-thread' },
                  async: true,
                },
              },
            }),
          ],
        },
      })

      await rsbuild.inspectConfig()

      const setupMiddlewares = rsbuild.getNormalizedConfig().dev
        ?.setupMiddlewares as SetupMiddlewares[] | undefined
      expect(setupMiddlewares).toHaveLength(1)
      const firstSetupMiddleware = setupMiddlewares?.[0]
      expect(firstSetupMiddleware).toBeDefined()

      const middlewares = firstSetupMiddleware ? firstSetupMiddleware([]) : []
      expect(middlewares).toHaveLength(1)
      const firstMiddleware = middlewares[0]
      expect(firstMiddleware).toBeDefined()

      let nextCalled = false
      const res = new MockResponse()
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve)
        res.on('error', reject)
      })

      firstMiddleware!(
        {
          url: '/nested/comp-lib.lynx.bundle',
        } as IncomingMessage & { url?: string },
        res as unknown as ServerResponse,
        () => {
          nextCalled = true
        },
      )

      await finished

      expect(nextCalled).toBe(false)
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('should emit explicit bundlePath assets from externalBundleRoot', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const distRoot = mkdtempSync(path.join(tmpdir(), 'rspeedy-externals-'))
    const externalBundleRoot = mkdtempSync(
      path.join(tmpdir(), 'rspeedy-external-bundles-'),
    )
    const projectRoot = mkdtempSync(
      path.join(tmpdir(), 'rspeedy-externals-src-'),
    )
    const entryFile = path.join(projectRoot, 'index.js')
    const bundlePath = 'nested/comp-lib.lynx.bundle'
    const externalBundleFile = path.join(externalBundleRoot, bundlePath)

    writeFileSync(entryFile, 'console.log("external bundle test");')
    mkdirSync(path.dirname(externalBundleFile), { recursive: true })
    writeFileSync(externalBundleFile, 'external bundle')

    try {
      const rsbuild = await createRsbuild({
        cwd: __dirname,
        rsbuildConfig: {
          output: {
            distPath: {
              root: distRoot,
            },
          },
          source: {
            entry: {
              main: entryFile,
            },
          },
          plugins: [
            pluginStubLayers(),
            pluginExternalBundle({
              externalBundleRoot,
              externals: {
                './App.js': {
                  bundlePath,
                  libraryName: 'CompLib',
                  background: { sectionPath: 'CompLib' },
                  mainThread: { sectionPath: 'CompLib__main-thread' },
                  async: true,
                },
              },
            }),
          ],
        },
      })

      await rsbuild.build()

      const emittedBundleFile = path.join(distRoot, bundlePath)
      expect(existsSync(emittedBundleFile)).toBe(true)
      expect(readFileSync(emittedBundleFile, 'utf8')).toBe('external bundle')
    } finally {
      rmSync(distRoot, { recursive: true, force: true })
      rmSync(externalBundleRoot, { recursive: true, force: true })
      rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  test('should correctly pass layer names from LAYERS', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    const customLayers = {
      BACKGROUND: 'CUSTOM_BACKGROUND',
      MAIN_THREAD: 'CUSTOM_MAIN',
    }

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(customLayers),
          pluginExternalBundle({
            externals: {
              lodash: {
                bundlePath: 'lodash.lynx.bundle',
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )

    expect(externalBundlePlugin).toBeDefined()
    expect(externalBundlePlugin).toMatchObject({
      options: {
        backgroundLayer: 'CUSTOM_BACKGROUND',
        mainThreadLayer: 'CUSTOM_MAIN',
      },
    })
  })

  test('should allow config globalObject', async () => {
    const { pluginExternalBundle } = await import('../src/index.js')

    let capturedPlugins: unknown[] = []

    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        tools: {
          rspack(config) {
            capturedPlugins = config.plugins || []
            return config
          },
        },
        plugins: [
          pluginStubLayers(),
          pluginExternalBundle({
            externals: {
              lodash: {
                bundlePath: 'lodash.lynx.bundle',
                background: { sectionPath: 'background' },
                mainThread: { sectionPath: 'mainThread' },
              },
            },
            globalObject: 'globalThis',
          }),
        ],
      },
    })

    await rsbuild.inspectConfig()

    const externalBundlePlugin = capturedPlugins.find(
      (plugin) => plugin instanceof ExternalsLoadingPlugin,
    )
    expect(externalBundlePlugin).toBeDefined()
    expect(externalBundlePlugin).toMatchObject({
      options: {
        globalObject: 'globalThis',
      },
    })
  })
})
