// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { isIP, isIPv4 } from 'node:net'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import type {
  RsbuildConfig,
  RsbuildPlugin,
  RsbuildPluginAPI,
} from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import type { LynxPluginOptions } from '../src/index.js'

function createDevStubRsbuild(
  rsbuildConfig: RsbuildConfig = {},
  lynxOptions?: LynxPluginOptions,
) {
  return createStubRsbuild(
    { mode: 'development', ...rsbuildConfig },
    undefined,
    lynxOptions,
  )
}

interface PrintedUrl {
  url: string
  label?: string | undefined
}

interface PrintedUrls {
  urls: PrintedUrl[]
  routes: { entryName: string, pathname: string }[]
}

function capturePrintUrls(
  rsbuild: Awaited<ReturnType<typeof createStubRsbuild>>,
): PrintedUrls {
  const printed: PrintedUrls = { urls: [], routes: [] }

  rsbuild.modifyRsbuildConfig({
    handler: (config, { mergeRsbuildConfig }) => {
      if (typeof config.server?.printUrls !== 'function') {
        return config
      }
      const originalPrintUrls = config.server.printUrls
      return mergeRsbuildConfig(config, {
        server: {
          printUrls: (param) => {
            printed.routes = param.routes.map(({ entryName, pathname }) => ({
              entryName,
              pathname,
            }))
            const result = originalPrintUrls(param)
            printed.urls = (result ?? []).map(entry =>
              typeof entry === 'string' ? { url: entry } : entry
            )
            return result
          },
        },
      })
    },
    order: 'post',
  })

  return printed
}

describe('pluginDev', () => {
  beforeEach(async () => {
    rstest.mock('../src/webpack/ProvidePlugin.js', { mock: true })

    const { default: os } = await import('node:os')

    rstest.spyOn(os, 'networkInterfaces').mockReturnValue({
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
      rstest.restoreAllMocks()
    }
  })

  test('defaults', async () => {
    const rsbuild = await createDevStubRsbuild()

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

    expect(rsbuild.getRsbuildConfig().server!.host).toBe('0.0.0.0')
  })

  test('defaults fallback to ipv6 when no ipv4 is found', async () => {
    const { default: os } = await import('node:os')

    rstest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        {
          address: 'fd00::1',
          family: 'IPv6',
          internal: false,
          netmask: 'ffff:ffff:ffff:ffff::',
          mac: '00:00:00:00:00:00',
          scopeid: 0,
          cidr: 'fd00::1/64',
        },
      ],
    })

    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(rsbuild.getRsbuildConfig().server!.host).toBe('::')
    expect(config.output?.publicPath).toBe('http://[fd00::1]:3000/')
    expect(rsbuild.getRsbuildConfig().dev!.client!.host).toBe('[fd00::1]')
  })

  test('defaults fallback to ipv4 loopback when no non-loopback ip is found', async () => {
    const { default: os } = await import('node:os')

    rstest.spyOn(os, 'networkInterfaces').mockReturnValue({
      lo: [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
          netmask: '255.0.0.0',
          mac: '00:00:00:00:00:00',
          cidr: '127.0.0.1/8',
        },
      ],
    })

    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(rsbuild.getRsbuildConfig().server!.host).toBe('0.0.0.0')
    expect(config.output?.publicPath).toBe('http://127.0.0.1:3000/')
    expect(rsbuild.getRsbuildConfig().dev!.client!.host).toBe('127.0.0.1')
  })

  test('explicit server.host does not fall back to ipv4 loopback', async () => {
    const { default: os } = await import('node:os')

    rstest.spyOn(os, 'networkInterfaces').mockReturnValue({
      lo: [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
          netmask: '255.0.0.0',
          mac: '00:00:00:00:00:00',
          cidr: '127.0.0.1/8',
        },
      ],
    })

    const rsbuild = await createDevStubRsbuild({
      server: {
        host: '0.0.0.0',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(rsbuild.getRsbuildConfig().server!.host).toBe('0.0.0.0')
    expect(config.output?.publicPath).toBe('http://0.0.0.0:3000/')
    expect(rsbuild.getRsbuildConfig().dev!.client!.host).toBe('0.0.0.0')
  })

  test('defaults keep server.host when no ip is found', async () => {
    const { default: os } = await import('node:os')

    rstest.spyOn(os, 'networkInterfaces').mockReturnValue({})

    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(rsbuild.getRsbuildConfig().server!.host).toBe('0.0.0.0')
    expect(config.output?.publicPath).toBe('http://0.0.0.0:3000/')
    expect(rsbuild.getRsbuildConfig().dev!.client!.host).toBe('0.0.0.0')
  })

  test('dev.assetPrefix uses server.host modified by plugins', async () => {
    const rsbuild = await createDevStubRsbuild({
      plugins: [
        {
          name: 'test:server-host',
          setup(api) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
              return mergeRsbuildConfig(config, {
                server: {
                  host: '10.0.0.2',
                },
              })
            })
          },
        } satisfies RsbuildPlugin,
      ],
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.output?.publicPath).toBe('http://10.0.0.2:3000/')
    expect(rsbuild.getRsbuildConfig().dev!.client!.host).toBe('10.0.0.2')
  })

  test('provide HMR variables', async () => {
    const rsbuild = await createDevStubRsbuild()

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../src/webpack/ProvidePlugin.js')

    expect(rstest.isMockFunction(ProvidePlugin)).toBe(true)
    expect(rstest.mocked(ProvidePlugin)).toBeCalled()
    expect(ProvidePlugin).toHaveBeenCalledWith({
      WebSocket: [require.resolve('@lynx-js/websocket'), 'default'],
    })
    expect(ProvidePlugin).toHaveBeenCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
  })

  test('alias HMR entries', async () => {
    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@rspack/core/hot/emitter.js',
      expect.stringContaining('hot/emitter.js'.replaceAll('/', path.sep)),
    )
    expect(config.resolve?.alias).toHaveProperty(
      '@rspack/core/hot/dev-server',
      expect.stringContaining('hotDevServer.js'),
    )
    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining(
        'packages/webpack/webpack-dev-transport'.replaceAll('/', path.sep),
      ),
    )
  })

  test('alias every @rspack/core/hot subpath the client imports', async () => {
    // `@rspack/core` is not a dependency of `@lynx-js/webpack-dev-transport`,
    // so every subpath its client imports has to be aliased here or the app
    // build breaks wherever the package manager does not hoist it.
    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    const { createRequire } = await import('node:module')
    const { readdir, readFile } = await import('node:fs/promises')
    const clientDir = path.resolve(
      path.dirname(
        createRequire(import.meta.url).resolve(
          '@lynx-js/webpack-dev-transport/client',
        ),
      ),
      '../../client',
    )
    const entries = await readdir(clientDir, { recursive: true })
    const sources = await Promise.all(
      entries
        .filter(name => /\.[cm]?tsx?$/.test(name))
        .map(name => readFile(path.join(clientDir, name), 'utf-8')),
    )
    // Covers `from '…'`, bare side-effect `import '…'` and `import('…')`,
    // under either quote style. `declare module '…'` is deliberately not a
    // match -- a type shim needs no alias.
    const importRE =
      /(?:from|import)\s*(?:\(\s*)?(['"])(@rspack\/core\/hot\/[^'"]+)\1/g
    const imported = new Set(
      sources.flatMap(source =>
        [...source.matchAll(importRE)].map(([, , specifier]) => specifier!)
      ),
    )

    expect(imported.size).toBeGreaterThan(0)
    for (const specifier of imported) {
      expect(config.resolve?.alias).toHaveProperty(specifier)
    }
  })

  test('no Websocket class injected for web', async () => {
    const rsbuild = await createDevStubRsbuild({
      environments: {
        web: {},
      },
    })

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../src/webpack/ProvidePlugin.js')

    expect(rstest.isMockFunction(ProvidePlugin)).toBe(true)
    expect(rstest.mocked(ProvidePlugin)).toBeCalled()
    expect(ProvidePlugin).toBeCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
    expect(ProvidePlugin).not.toBeCalledWith(
      expect.objectContaining({ WebSocket: expect.anything() as unknown }),
    )
  })

  test('not inject entry and provide variables in production', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../src/webpack/ProvidePlugin.js')

    expect(ProvidePlugin).not.toBeCalled()
  })

  test('not inject Rsbuild HMR client', async () => {
    const rsbuild = await createDevStubRsbuild()
    const config = await rsbuild.unwrapConfig()

    const entries = config.plugins?.filter(i =>
      i && i.constructor.name === 'EntryPlugin'
    )
    // No @rsbuild/core/client/hmr is injected
    expect(entries).toHaveLength(0)
  })

  test('dev.assetPrefix', async () => {
    const rsbuild = await createDevStubRsbuild({
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
    const rsbuild = await createStubRsbuild({
      mode: 'production',
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
    const rsbuild = await createDevStubRsbuild({
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
    const rsbuild = await createDevStubRsbuild({
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
    const rsbuild = await createDevStubRsbuild({
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
    const rsbuild = await createDevStubRsbuild({
      dev: {
        assetPrefix: 'http://example.com:<port>/',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).not.toContain('<port>')
  })

  test('dev.assetPrefix with <port> placeholder and server.port', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:<port>/',
      },
      server: {
        port: 8097,
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
    const rsbuild = await createDevStubRsbuild({
      dev: {
        assetPrefix: false,
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toBe('/')
  })

  test('dev.assetPrefix: false with server.port', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('dev.assetPrefix: false with server.base', async () => {
    const rsbuild = await createDevStubRsbuild({
      dev: {
        assetPrefix: false,
      },
      server: {
        base: '/dist',
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(typeof config.output?.publicPath).toBe('string')
    expect(config.output?.publicPath).toBe('/')
    expect(rsbuild.getRsbuildConfig().dev!.assetPrefix).toBe(false)
  })

  test('assetPrefix with mode production', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
    })

    // dev.plugin.js will not be applied by default in production mode
    rsbuild.addPlugins([
      await import('../src/plugins/dev.plugin.js').then(
        ({ pluginDev }) => pluginDev(),
      ),
    ])

    const config = await rsbuild.unwrapConfig()

    expect(config.output?.publicPath).not.toBe('/')
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

    const rsbuild = await createDevStubRsbuild({
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
    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=true'),
    )
  })

  test('dev.hmr: false', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('environment.dev.hmr: false', async () => {
    const rsbuild = await createDevStubRsbuild({
      environments: {
        lynx: {
          dev: {
            hmr: false,
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=false'),
    )
  })

  test('dev.hmr: true', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('environment dev.hmr: true', async () => {
    const rsbuild = await createDevStubRsbuild({
      environments: {
        lynx: {
          dev: {
            hmr: true,
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('hot=true'),
    )
  })

  test('dev.liveReload default', async () => {
    const rsbuild = await createDevStubRsbuild()

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=true'),
    )
  })

  test('dev.liveReload: false', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('environment dev.liveReload: false', async () => {
    const rsbuild = await createDevStubRsbuild({
      environments: {
        lynx: {
          dev: {
            liveReload: false,
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=false'),
    )
  })

  test('dev.liveReload: true', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('environments dev.liveReload: true', async () => {
    const rsbuild = await createDevStubRsbuild({
      environments: {
        lynx: {
          dev: {
            liveReload: true,
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
      expect.stringContaining('live-reload=true'),
    )
  })

  test('writeToDisk defaults to true', async () => {
    let writeToDisk: unknown

    const rsbuild = await createDevStubRsbuild({
      plugins: [{
        name: 'test:capture',
        setup(api: RsbuildPluginAPI) {
          api.modifyBundlerChain(() => {
            writeToDisk = api.getNormalizedConfig().dev.writeToDisk
          })
        },
      }],
    })

    await rsbuild.unwrapConfig()

    expect(writeToDisk).toBe(true)
  })

  test('writeToDisk keeps a user value', async () => {
    let writeToDisk: unknown

    const rsbuild = await createDevStubRsbuild({
      dev: { writeToDisk: false },
      plugins: [{
        name: 'test:capture',
        setup(api: RsbuildPluginAPI) {
          api.modifyBundlerChain(() => {
            writeToDisk = api.getNormalizedConfig().dev.writeToDisk
          })
        },
      }],
    })

    await rsbuild.unwrapConfig()

    expect(writeToDisk).toBe(false)
  })

  test('provides the WebSocket that HMR resolves', async () => {
    const rsbuild = await createDevStubRsbuild({})

    await rsbuild.unwrapConfig()

    const { ProvidePlugin } = await import('../src/webpack/ProvidePlugin.js')

    expect(ProvidePlugin).toHaveBeenCalledWith({
      WebSocket: [require.resolve('@lynx-js/websocket'), 'default'],
    })
    expect(ProvidePlugin).toHaveBeenCalledWith({
      __webpack_dev_server_client__: [
        require.resolve('../client/hmr/WebSocketClient.js'),
        'default',
      ],
    })
  })

  test('server.base without /', async () => {
    await expect(async () => {
      const rsbuild = await createDevStubRsbuild({
        server: {
          base: 'dist',
        },
      })

      await rsbuild.unwrapConfig()
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: [rsbuild:config] The "server.base" option should start with a slash, for example: "/base"]`,
    )
  })

  test('dev.assetPrefix with server.base', async () => {
    const rsbuild = await createDevStubRsbuild({
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

  test('environment.web to have middleware installed', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      environments: {
        web: {},
        lynx: {},
      },
    })
    const middleware = await import('@lynx-js/web-rsbuild-server-middleware')
    rstest.spyOn(middleware, 'createWebVirtualFilesMiddleware')

    await using server = await rsbuild.usingDevServer()
    await server.waitDevCompileDone()
    expect(rstest.mocked(middleware.createWebVirtualFilesMiddleware))
      .toBeCalled()
  })

  test('dev.assetPrefix with server.printUrls', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8091,
      },
    })

    let printedUrls: undefined | (string | { url: string, label?: string })[] =
      undefined

    rsbuild.modifyRsbuildConfig({
      handler: (config, { mergeRsbuildConfig }) => {
        if (typeof config.server?.printUrls === 'function') {
          const originalPrintUrls = config.server.printUrls
          return mergeRsbuildConfig(config, {
            server: {
              printUrls: (...args) => {
                const result = originalPrintUrls(...args)
                printedUrls = result ?? undefined
                return result
              },
            },
          })
        }
        return config
      },
      order: 'post',
    })

    await using server = await rsbuild.usingDevServer()

    await server.waitDevCompileDone()

    expect(printedUrls).toContainEqual({
      'label': 'Lynx',
      'url': 'http://example.com:8091/main.lynx.bundle',
    })
  })

  test('dev.assetPrefix with environment.web', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8092,
      },
      environments: {
        web: {},
        lynx: {},
      },
    })

    let printedUrls: undefined | (string | { url: string, label?: string })[] =
      undefined

    rsbuild.modifyRsbuildConfig({
      handler: (config, { mergeRsbuildConfig }) => {
        if (typeof config.server?.printUrls === 'function') {
          const originalPrintUrls = config.server.printUrls
          return mergeRsbuildConfig(config, {
            server: {
              printUrls: (...args) => {
                const result = originalPrintUrls(...args)
                printedUrls = result ?? undefined
                return result
              },
            },
          })
        }
        return config
      },
      order: 'post',
    })

    await using server = await rsbuild.usingDevServer()

    await server.waitDevCompileDone()

    expect(printedUrls).toContainEqual({
      'label': 'Web',
      'url': 'http://example.com:8092/main.web.bundle',
    })

    expect(printedUrls).toContainEqual({
      'label': '∟ Preview',
      'url': 'http://example.com:8092/__web_preview?casename=main.web.bundle',
    })
  })

  test('server.printUrls with per-environment entries', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          rootMain: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8098,
      },
      environments: {
        lynx: {
          source: {
            entry: {
              lynxMain: path.resolve(
                __dirname,
                './fixtures/hello-world/index.js',
              ),
            },
          },
        },
        web: {
          source: {
            entry: {
              webMain: path.resolve(
                __dirname,
                './fixtures/hello-world/index.js',
              ),
            },
          },
        },
      },
    })

    let printedUrls: undefined | (string | { url: string, label?: string })[] =
      undefined

    rsbuild.modifyRsbuildConfig({
      handler: (config, { mergeRsbuildConfig }) => {
        if (typeof config.server?.printUrls === 'function') {
          const originalPrintUrls = config.server.printUrls
          return mergeRsbuildConfig(config, {
            server: {
              printUrls: (...args) => {
                const result = originalPrintUrls(...args)
                printedUrls = result ?? undefined
                return result
              },
            },
          })
        }
        return config
      },
      order: 'post',
    })

    await using server = await rsbuild.usingDevServer()

    await server.waitDevCompileDone()

    expect(printedUrls).toContainEqual({
      'label': 'Lynx',
      'url': 'http://example.com:8098/lynxMain.lynx.bundle',
    })

    expect(printedUrls).toContainEqual({
      'label': 'Web',
      'url': 'http://example.com:8098/webMain.web.bundle',
    })

    // A root entry is merged into every environment, not replaced by an
    // environment's own.
    expect(printedUrls).toContainEqual({
      'label': 'Lynx',
      'url': 'http://example.com:8098/rootMain.lynx.bundle',
    })

    expect(printedUrls).toContainEqual({
      'label': 'Web',
      'url': 'http://example.com:8098/rootMain.web.bundle',
    })

    // Never cross an environment's own entry with another environment.
    expect(printedUrls).not.toContainEqual({
      'label': 'Web',
      'url': 'http://example.com:8098/lynxMain.web.bundle',
    })

    expect(printedUrls).not.toContainEqual({
      'label': 'Lynx',
      'url': 'http://example.com:8098/webMain.lynx.bundle',
    })
  })

  test('server.printUrls with a per-environment dev.assetPrefix', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8000/',
      },
      server: {
        port: 8099,
      },
      environments: {
        lynx: {},
        web: {
          dev: {
            assetPrefix: 'http://web.example.com:<port>/',
          },
        },
      },
    })

    let printedUrls: undefined | (string | { url: string, label?: string })[] =
      undefined

    rsbuild.modifyRsbuildConfig({
      handler: (config, { mergeRsbuildConfig }) => {
        if (typeof config.server?.printUrls === 'function') {
          const originalPrintUrls = config.server.printUrls
          return mergeRsbuildConfig(config, {
            server: {
              printUrls: (...args) => {
                const result = originalPrintUrls(...args)
                printedUrls = result ?? undefined
                return result
              },
            },
          })
        }
        return config
      },
      order: 'post',
    })

    await using server = await rsbuild.usingDevServer()

    await server.waitDevCompileDone()

    // `lynx` keeps the root `dev.assetPrefix`.
    expect(printedUrls).toContainEqual({
      'label': 'Lynx',
      'url': 'http://example.com:8099/main.lynx.bundle',
    })

    // `web` overrides `dev.assetPrefix` on its own environment.
    expect(printedUrls).toContainEqual({
      'label': 'Web',
      'url': 'http://web.example.com:8099/main.web.bundle',
    })

    expect(printedUrls).toContainEqual({
      'label': '∟ Preview',
      'url':
        'http://web.example.com:8099/__web_preview?casename=main.web.bundle',
    })
  })

  test('dev prints the bundle URL without writing to routes', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8093/',
      },
      server: {
        port: 8093,
      },
    })

    const printed = capturePrintUrls(rsbuild)

    await using server = await rsbuild.usingDevServer()
    await server.waitDevCompileDone()

    // Rsbuild appends `route.pathname` to whatever is returned here, so the
    // bundle path may only be resolved once, and only while nothing else
    // supplies it.
    expect(printed.routes).toStrictEqual([])
    expect(printed.urls).toContainEqual({
      label: 'Lynx',
      url: 'http://example.com:8093/main.lynx.bundle',
    })
  })

  test('dev prints one URL per environment', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8094/',
      },
      server: {
        port: 8094,
      },
      environments: {
        web: {},
        lynx: {},
      },
    })

    const printed = capturePrintUrls(rsbuild)

    await using server = await rsbuild.usingDevServer()
    await server.waitDevCompileDone()

    expect(printed.routes).toStrictEqual([])
    expect(printed.urls).toContainEqual({
      label: 'Lynx',
      url: 'http://example.com:8094/main.lynx.bundle',
    })
    expect(printed.urls).toContainEqual({
      label: 'Web',
      url: 'http://example.com:8094/main.web.bundle',
    })
  })

  test('preview prints the bundle path exactly once', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8095/',
      },
      server: {
        port: 8095,
      },
      environments: {
        web: {},
        lynx: {},
      },
    })

    const printed = capturePrintUrls(rsbuild)

    const { server } = await rsbuild.preview({ checkDistDir: false })
    try {
      // The preview server fills `routes` before printing, so a plugin that
      // writes to them would have Rsbuild append the bundle path a second
      // time.
      expect(printed.routes).toStrictEqual([])
      expect(printed.urls).toContainEqual({
        label: 'Lynx',
        url: 'http://example.com:8095/main.lynx.bundle',
      })
    } finally {
      await server.close()
    }
  })

  test('preview prints base URLs when another plugin supplies routes', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8097/',
      },
      server: {
        port: 8097,
      },
    })

    rsbuild.onAfterStartPreviewServer(({ routes }) => {
      routes.push({ entryName: 'main', pathname: '/main.lynx.bundle' })
    })

    const printed = capturePrintUrls(rsbuild)

    const { server } = await rsbuild.preview({ checkDistDir: false })
    try {
      expect(printed.routes).toStrictEqual([
        { entryName: 'main', pathname: '/main.lynx.bundle' },
      ])
      // Rsbuild appends the pathname of every route, so only the base URL
      // belongs here.
      expect(printed.urls).toStrictEqual([
        { label: 'Lynx', url: 'http://example.com:8097/' },
      ])
    } finally {
      await server.close()
    }
  })

  test('filename.bundle is used for the printed URL', async () => {
    const rsbuild = await createDevStubRsbuild({
      source: {
        entry: {
          main: path.resolve(__dirname, './fixtures/hello-world/index.js'),
        },
      },
      dev: {
        assetPrefix: 'http://example.com:8096/',
      },
      server: {
        port: 8096,
      },
    }, {
      output: {
        filename: { bundle: '[name].[platform].custom.bundle' },
      },
    })

    const printed = capturePrintUrls(rsbuild)

    await using server = await rsbuild.usingDevServer()
    await server.waitDevCompileDone()

    expect(printed.urls).toContainEqual({
      label: 'Lynx',
      url: 'http://example.com:8096/main.lynx.custom.bundle',
    })
  })
})
