// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

vi.mock('../../src/webpack/EvalDevToolModulePlugin.ts')
vi.mock('../../src/webpack/EvalSourceMapDevToolPlugin.ts')
vi.mock('../../src/webpack/SourceMapDevToolPlugin.ts')

beforeEach(() => {
  vi.resetAllMocks()
})

describe('sourcemap.plugin', () => {
  describe('production', () => {
    test('defaults', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({})
      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.assetPrefix', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          assetPrefix: 'https://example.com/',
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.assetPrefix with output.sourceMap.js: "source-map"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          assetPrefix: 'https://example.com/',
          sourceMap: {
            js: 'source-map',
          },
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      // source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'https://example.com/',
          filename: '[file].map[query]',
          columns: true, // non cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.assetPrefix with output.sourceMap.js: "source-map-debugids"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          assetPrefix: 'https://example.com/',
          sourceMap: {
            js: 'source-map-debugids',
          },
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      // source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'https://example.com/',
          filename: '[file].map[query]',
          columns: true, // non cheap
          module: true, // module
          noSources: false,
          debugIds: true, // debugids
        }),
      )
    })

    test('with output.sourceMap.js: "cheap-module-source-map"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: 'cheap-module-source-map',
          },
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)

      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap.js: "hidden-source-map"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: 'hidden-source-map',
          },
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)

      // hidden-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          append: false, // hidden
          columns: true, // non cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap: false', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: false,
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap: true', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: true,
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)

      // source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          columns: true, // non cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with output.sourceMap.js: false', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: false,
          },
        },
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap.js modified by plugin', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const rspeedy = await createStubRspeedy({
        plugins: [
          {
            name: 'test',
            setup(api) {
              api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
                return mergeRsbuildConfig(config, {
                  output: {
                    sourceMap: {
                      js: 'hidden-nosources-source-map', // cSpell:disable-line
                    },
                  },
                })
              })
            },
          } satisfies RsbuildPlugin,
        ],
      })

      const config = await rspeedy.unwrapConfig()
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // 'hidden-nosources-source-map' with publicPath applied // cSpell:disable-line
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: '/',
          filename: '[file].map[query]',
          append: false, // hidden
          columns: true, // non cheap
          module: true, // module
          noSources: true, // no sources
          debugIds: false,
        }),
      )
    })
  })

  describe('development', () => {
    test('defaults', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({})
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
          debugIds: false,
        }),
      )
    })

    test('with server.port', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        server: {
          port: 4000,
        },
      })
      const config = await rspeedy.unwrapConfig()

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

    test('with output.sourceMap.js: "eval-cheap-module-source-map"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: 'eval-cheap-module-source-map',
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      // eval-cheap-module-source-map with publicPath applied
      expect(EvalSourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
        }),
      )
    })

    test('with output.sourceMap.js: "source-map-debugids"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: 'source-map-debugids',
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
      // source-map-debugids applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map[query]',
          columns: true, // non cheap
          module: true, // module
          noSources: false,
          debugIds: true, // debugIds
        }),
      )
    })

    test('with output.sourceMap.js: "eval"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )

      const { EvalSourceMapDevToolPlugin } = await import(
        '../../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: 'eval',
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe('eval')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with output.sourceMap.js: false', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const { EvalSourceMapDevToolPlugin } = await import(
        '../../src/webpack/EvalSourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        output: {
          sourceMap: {
            js: false,
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
      expect(EvalSourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        dev: {
          assetPrefix: `http://example.com:4000/`,
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'http://example.com:4000/',
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
        }),
      )
    })

    test('with dev.assetPrefix contains "<port>"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        dev: {
          assetPrefix: `http://example.com:<port>/`,
        },
        server: {
          port: 4000,
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      // cheap-module-source-map with publicPath applied
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          publicPath: 'http://example.com:4000/',
          filename: '[file].map[query]',
          columns: false, // cheap
          module: true, // module
          noSources: false,
        }),
      )
    })

    test('with dev.assetPrefix contains "<port>" and port being occupied', async () => {
      vi.stubEnv('NODE_ENV', 'development')
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
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        source: {
          entry: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
        dev: {
          assetPrefix: `http://example.com:<port>/`,
        },
        server: {
          port,
        },
      })

      await using server = await rspeedy.usingDevServer()

      const config = await rspeedy.unwrapConfig()

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
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        dev: {
          assetPrefix: false,
        },
      })
      const config = await rspeedy.unwrapConfig()

      // Should use the default devtool option
      expect(config.devtool).toBe('cheap-module-source-map')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix: false and output.sourceMap.js: false', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        dev: {
          assetPrefix: false,
        },
        output: {
          sourceMap: {
            js: false,
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      // Should use the user specified devtool option
      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    test('with dev.assetPrefix: false and output.sourceMap.js: "eval-source-map"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        dev: {
          assetPrefix: false,
        },
        output: {
          sourceMap: {
            js: 'eval-source-map',
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      // Should use the user specified devtool option
      expect(config.devtool).toBe('eval-source-map')
      expect(SourceMapDevToolPlugin).not.toBeCalled()
    })

    // TODO: this can not pass for now.
    test.skip('with tools.rspack.output.sourceMapFilename', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { SourceMapDevToolPlugin } = await import(
        '../../src/webpack/SourceMapDevToolPlugin.js'
      )
      const rspeedy = await createStubRspeedy({
        tools: {
          rspack: {
            output: {
              sourceMapFilename: '[file].map',
            },
          },
        },
      })
      const config = await rspeedy.unwrapConfig()

      expect(config.devtool).toBe(false)
      expect(SourceMapDevToolPlugin).toBeCalled()
      expect(SourceMapDevToolPlugin).toBeCalledWith(
        expect.objectContaining({
          filename: '[file].map', // custom sourceMapFilename
          columns: false, // cheap
          module: true, // module
          noSources: false,
        }),
      )
    })
  })
})
