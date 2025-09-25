// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { isIP, isIPv4 } from 'node:net'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import { assert, beforeEach, describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

vi.mock('node:os')

describe('Plugins - Dev', () => {
  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.mock('../../src/webpack/ProvidePlugin.js')

    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: '192.168.1.1',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.1.1/24',
        },
      ],
    })

    return () => {
      vi.unstubAllEnvs()
        .restoreAllMocks()
    }
  })

  test('defaults', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )
    expect(port).toBe('3000')
    // Returns 6 if input is an IPv6 address. Returns 4 if input is an IPv4 address in dot-decimal notation with no leading zeroes. Otherwise, returns 0.
    expect(isIP(hostname)).not.toBe(0)
    expect(isIPv4(hostname)).toBe(true)
    expect(pathname).toBe('/')

    expect(isIPv4(rsbuild.getRsbuildConfig().dev!.client!.host!)).toBe(true)

    assert(config.resolve?.alias)

    expect(config.resolve.alias['webpack/hot/emitter.js']).toStrictEqual(
      expect.stringContaining(
        ('@rspack/core/hot/emitter.js').replaceAll('/', path.sep),
      ),
    )
  })

  test('provide HMR variables', async () => {
    const rsbuild = await createStubRspeedy({})

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../../src/webpack/ProvidePlugin.js')

    expect(vi.isMockFunction(ProvidePlugin)).toBe(true)
    expect(vi.mocked(ProvidePlugin)).toBeCalled()
    expect(ProvidePlugin).toHaveBeenCalledWith({
      WebSocket: [require.resolve('@lynx-js/websocket'), 'default'],
    })
    expect(ProvidePlugin).toHaveBeenCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
  })

  test('alias HMR entries', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@rspack/core/hot/dev-server',
      expect.stringContaining('hot/dev-server.js'.replaceAll('/', path.sep)),
    )
    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining(
        'packages/webpack/webpack-dev-transport'.replaceAll('/', path.sep),
      ),
    )
  })

  test('no Websocket class injected for web', async () => {
    const rsbuild = await createStubRspeedy({
      environments: {
        web: {},
      },
    })

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../../src/webpack/ProvidePlugin.js')

    expect(vi.isMockFunction(ProvidePlugin)).toBe(true)
    expect(vi.mocked(ProvidePlugin)).toBeCalled()
    expect(ProvidePlugin).toBeCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
  })

  test('not inject entry and provide variables in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rsbuild = await createStubRspeedy({})

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../../src/webpack/ProvidePlugin.js')

    expect(ProvidePlugin).not.toBeCalled()
  })

  test('not inject Rsbuild HMR client', async () => {
    const rsbuild = await createStubRspeedy({})
    const config = await rsbuild.unwrapConfig()

    const entries = config.plugins?.filter(i =>
      i && i.constructor.name === 'EntryPlugin'
    )
    // No @rsbuild/core/client/hmr is injected
    expect(entries).toHaveLength(0)
  })

  test('Rsbuild taps on compiler', async () => {
    const rsbuild = await createStubRspeedy({})

    const { rspack } = await import('@rsbuild/core')

    const compiler = rspack.rspack({})

    await rsbuild.createDevServer({ compiler })

    // See: https://github.com/web-infra-dev/rsbuild/pull/2303
    expect(compiler.hooks.compile.taps.map(i => i.name)).toMatchInlineSnapshot(`
      [
        "rsbuild-dev-server",
      ]
    `)

    expect(compiler.hooks.invalid.taps.map(i => i.name)).toMatchInlineSnapshot(`
      [
        "rsbuild-dev-server",
        "rsbuild-dev-middleware",
      ]
    `)

    expect(compiler.hooks.done.taps.map(i => i.name)).toMatchInlineSnapshot(`
      [
        "rsbuild-dev-server",
        "rsbuild-dev-middleware",
      ]
    `)
  })

  test('dev.assetPrefix', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com/',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )
    expect(port).toBe('')
    // Returns 6 if input is an IPv6 address. Returns 4 if input is an IPv4 address in dot-decimal notation with no leading zeroes. Otherwise, returns 0.
    expect(isIP(hostname)).toBe(0)
    expect(hostname).toBe('example.com')
    expect(pathname).toBe('/')
  })

  test('dev.assetPrefix should not take effect in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:3000/',
      },
    })

    const config = await rsbuild.unwrapConfig({
      action: 'build',
    })

    expect(config.output?.publicPath).toBe('/')
  })

  test('dev.assetPrefix with server.port', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8000,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )
    expect(port).toBe('8000')
    // Returns 6 if input is an IPv6 address. Returns 4 if input is an IPv4 address in dot-decimal notation with no leading zeroes. Otherwise, returns 0.
    expect(isIP(hostname)).toBe(0)
    expect(hostname).toBe('example.com')
    expect(pathname).toBe('/')
  })

  test('dev.assetPrefix with different server.port', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8080,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )
    expect(port).toBe('8080')
    // Returns 6 if input is an IPv6 address. Returns 4 if input is an IPv4 address in dot-decimal notation with no leading zeroes. Otherwise, returns 0.
    expect(isIP(hostname)).toBe(0)
    expect(hostname).toBe('example.com')
    expect(pathname).toBe('/')
  })

  test('dev.assetPrefix with server.host', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:3000/',
      },
      server: {
        host: 'foo.example.com',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )
    expect(port).toBe('3000')
    // Returns 6 if input is an IPv6 address. Returns 4 if input is an IPv4 address in dot-decimal notation with no leading zeroes. Otherwise, returns 0.
    expect(isIP(hostname)).toBe(0)
    expect(hostname).toBe('example.com')
    expect(pathname).toBe('/')
  })

  test('dev.assetPrefix with <port> placeholder', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:<port>/',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).not.toContain('<port>')
  })

  test('dev.assetPrefix with <port> placeholder and server.port', async () => {
    const net = await import('node:net')

    // We get a port that is occupied by the server we just created
    const port = await (function getPort() {
      return new Promise<number>((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)
        server.listen(0, () => {
          const address = server.address() as AddressInfo
          server.close(() => {
            resolve(address.port)
          })
        })
      })
    })()

    const rsbuild = await createStubRspeedy({
      source: {
        entry: path.resolve(__dirname, './fixtures/hello-world/index.js'),
      },
      dev: {
        assetPrefix: 'http://example.com:<port>/',
      },
      server: {
        port,
      },
    })

    await using server = await rsbuild.usingDevServer()

    await server.waitDevCompileDone()
    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toBe(
      `http://example.com:${server.port}/`,
    )
  })

  test('dev.assetPrefix: false', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: false,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toBe('/')
  })

  test('dev.assetPrefix: false with server.port', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: false,
      },
      server: {
        port: 4000,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toBe('/')
  })

  test('assetPrefix with mode production', async () => {
    const rsbuild = await createStubRspeedy({
      mode: 'production',
    })

    // dev.plugin.js will not be applied by default in production mode
    rsbuild.addPlugins([
      await import('../../src/plugins/dev.plugin.js').then(
        ({ pluginDev }) => pluginDev(),
      ),
    ])

    const config = await rsbuild.unwrapConfig()

    expect(config.output?.publicPath).not.toBe('/')
  })

  // The result of this test is not correct, since Rsbuild is using `context.devServer?.port || DEFAULT_PORT`
  // See: https://github.com/web-infra-dev/rsbuild/blob/4494b4bbf77f6e45d7d38fbaaa188a941227505d/packages/core/src/plugins/output.ts#L29
  // TODO: Fix this test after https://github.com/web-infra-dev/rsbuild/pull/4578 landed
  test.skip('server.port without dev.assetPrefix', async () => {
    const rsbuild = await createStubRspeedy({
      server: {
        port: 4000,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toContain(':4000/')
  })

  test('dev.assetPrefix should change when port is changed automatically', async () => {
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

    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com:<port>/',
      },
      server: {
        port,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.output?.publicPath).toContain(`http://example.com:`)
    expect(config.output?.publicPath).not.toBe(`http://example.com:${port}`)
  })

  test('dev.hmr default', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=true'),
    )
  })

  test('dev.hmr: false', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        hmr: false,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=false'),
    )
  })

  test('dev.hmr: true', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        hmr: true,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=true'),
    )
  })

  test('dev.liveReload default', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=true'),
    )
  })

  test('dev.liveReload: false', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        liveReload: false,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=false'),
    )
  })

  test('dev.liveReload: true', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        liveReload: true,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=true'),
    )
  })

  test('websocketTransport', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        client: {
          websocketTransport: '/foo',
        },
      },
    })

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../../src/webpack/ProvidePlugin.js')

    expect(ProvidePlugin).toHaveBeenCalledWith({
      WebSocket: ['/foo', 'default'],
    })
    expect(ProvidePlugin).toHaveBeenCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
  })

  test('server.base without /', async () => {
    try {
      const rsbuild = await createStubRspeedy({
        server: {
          base: 'dist',
        },
      })

      await rsbuild.unwrapConfig()
    } catch (error) {
      expect(error).toMatchInlineSnapshot(
        `[Error: [rsbuild:config] The "server.base" option should start with a slash, for example: "/base"]`,
      )
    }
  })

  test('dev.assetPrefix with server.base', async () => {
    const rsbuild = await createStubRspeedy({
      dev: {
        assetPrefix: 'http://example.com/',
      },
      server: {
        base: '/dist',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')

    expect(config.output?.publicPath).toContain('http://example.com/')
    expect(config.output?.publicPath).toContain('/dist/')

    const { port, hostname, pathname } = new URL(
      config.output!.publicPath! as string,
    )

    expect(port).toBe('')
    expect(isIP(hostname)).toBe(0)
    expect(hostname).toBe('example.com')
    expect(pathname).toBe('/dist/')
  })
})
