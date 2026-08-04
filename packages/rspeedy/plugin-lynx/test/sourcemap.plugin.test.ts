// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

rstest.mock('../src/webpack/EvalSourceMapDevToolPlugin.ts', { mock: true })
rstest.mock('../src/webpack/SourceMapDevToolPlugin.ts', { mock: true })

beforeEach(() => {
  rstest.resetAllMocks()
})

const hasDropPlugin = (plugins: unknown[] | undefined) =>
  !!plugins?.some(
    p =>
      typeof p === 'object' && p !== null
      && (p as { constructor?: { name?: string } }).constructor?.name
        === 'DropSourceMapAssetsPlugin',
  )

describe('pluginSourcemap', () => {
  describe('production', () => {
    test('defaults', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({})
      const config = await rsbuild.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.assetPrefix', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          assetPrefix: 'https://example.com/',
        },
      })

      const config = await rsbuild.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.assetPrefix with output.sourceMap.js: "source-map"', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          assetPrefix: 'https://example.com/',
          sourceMap: {
            js: 'source-map',
          },
        },
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'https://example.com/',
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.assetPrefix with output.sourceMap.js: "source-map-debugids"', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          assetPrefix: 'https://example.com/',
          sourceMap: {
            js: 'source-map-debugids',
          },
        },
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'https://example.com/',
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: true,
        }),
      )
    })

    test('with output.sourceMap.js: "cheap-module-source-map"', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: 'cheap-module-source-map',
          },
        },
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)

      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          columns: false,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap.js: "hidden-source-map"', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: 'hidden-source-map',
          },
        },
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)

      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          append: false,
          columns: true,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap: false', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: false,
        },
      })

      const config = await rsbuild.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap: true', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: true,
        },
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)

      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap.js: false', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: false,
          },
        },
      })

      const config = await rsbuild.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap.js modified by plugin', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rsbuild = await createStubRsbuild({
        plugins: [
          {
            name: 'test',
            setup(api) {
              api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
                return mergeRsbuildConfig(config, {
                  output: {
                    sourceMap: {
                      js: 'hidden-nosources-source-map',
                    },
                  },
                })
              })
            },
          } satisfies RsbuildPlugin,
        ],
      })

      const config = await rsbuild.unwrapConfig({
        action: 'build',
      })
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          append: false,
          columns: true,
          module: true,
          noSources: true,
          debugIds: false,
        }),
      )
    })
  })

  describe('development', () => {
    test('defaults', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({})
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: false,
          module: true,
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap.js: "eval-cheap-module-source-map"', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: 'eval-cheap-module-source-map',
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      expect(EvalSourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: false,
          module: true,
          noSources: false,
        }),
      )
    })

    test('with output.sourceMap.js: "source-map-debugids"', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: 'source-map-debugids',
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: true,
          module: true,
          noSources: false,
          debugIds: true,
        }),
      )
    })

    test('with output.sourceMap.js: "eval"', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )

      const { EvalSourceMapDevToolPlugin } = await import(
        '../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: 'eval',
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe('eval')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap.js: false', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        output: {
          sourceMap: {
            js: false,
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        dev: {
          assetPrefix: `http://example.com:4000/`,
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'http://example.com:4000/',
          filename: '[file].map[query]',
          columns: false,
          module: true,
          noSources: false,
        }),
      )
    })

    test('with dev.assetPrefix contains "<port>"', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        dev: {
          assetPrefix: `http://example.com:<port>/`,
        },
        server: {
          port: 4000,
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'http://example.com:4000/',
          filename: '[file].map[query]',
          columns: false,
          module: true,
          noSources: false,
        }),
      )
    })

    test('with server.port', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        server: {
          port: 4000,
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: expect.stringContaining(':4000/') as string,
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with dev.assetPrefix contains "<port>" and port being occupied', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const net = await import('node:net')

      // We get a port that is occupied by the server we just created
      const port = await (function getPort() {
        return new Promise<number>((resolve, reject) => {
          const server = net.createServer()
          server.unref()
          server.on('error', reject)
          server.listen(0, () => {
            resolve((server.address() as AddressInfo).port)
          })
        })
      })()

      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        source: {
          entry: {
            main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
          },
        },
        dev: {
          assetPrefix: `http://example.com:<port>/`,
        },
        server: {
          port,
        },
      })

      await using server = await rsbuild.usingDevServer()

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.publicPath).toBe(
        `http://example.com:${server.port}/`,
      )

      await server.waitDevCompileDone()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: config.output?.publicPath,
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
        }),
      )
    })

    test('with dev.assetPrefix: false', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        dev: {
          assetPrefix: false,
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe('cheap-module-source-map')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix: false and output.sourceMap.js: false', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        dev: {
          assetPrefix: false,
        },
        output: {
          sourceMap: {
            js: false,
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix: false and output.sourceMap.js: "eval-source-map"', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rsbuild = await createStubRsbuild({
        dev: {
          assetPrefix: false,
        },
        output: {
          sourceMap: {
            js: 'eval-source-map',
          },
        },
      })
      const config = await rsbuild.unwrapConfig()

      expect(config.devtool).toBe('eval-source-map')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })
  })

  describe('drop .map assets', () => {
    test('production build drops .map assets', async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const rsbuild = await createStubRsbuild({})
      const config = await rsbuild.unwrapConfig({ action: 'build' })
      expect(hasDropPlugin(config.plugins)).toBe(true)
    })

    test('dev build drops .map assets', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const rsbuild = await createStubRsbuild({})
      const config = await rsbuild.unwrapConfig()
      expect(hasDropPlugin(config.plugins)).toBe(true)
    })

    test('does not drop .map assets when dev.assetPrefix is false', async () => {
      rstest.stubEnv('NODE_ENV', 'development')
      const rsbuild = await createStubRsbuild({
        dev: { assetPrefix: false },
      })
      const config = await rsbuild.unwrapConfig()
      expect(hasDropPlugin(config.plugins)).toBe(false)
    })
  })
})
