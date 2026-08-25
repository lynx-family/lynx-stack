// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild, logger } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import type { Config, ExposedAPI, RsbuildPlugin } from '@lynx-js/rspeedy'

import { getRandomNumberInRange } from './port.js'
import { pluginQRCode } from '../src/index.js'

vi.mock('uqr')
vi.mock('@clack/prompts')

const exit = vi.fn()

// `pluginQRCode` reads the Lynx config the build engine exposes, so the stub
// applies the engine's config plugin the way a real Lynx build does.
const exposeLynxConfig = (api: RsbuildPluginAPI): void => {
  let lynx: unknown

  for (const plugin of pluginLynx()) {
    void plugin.setup({
      expose(_id: string | symbol, value: unknown) {
        lynx = value
      },
    } as unknown as RsbuildPluginAPI)

    if (lynx) {
      break
    }
  }

  api.expose(Symbol.for('@lynx-js/rsbuild-plugin:config'), lynx)
}

const pluginStubRspeedyAPI = (config: Config = {}): RsbuildPlugin => ({
  name: 'lynx:rsbuild:api',
  setup(api) {
    api.expose<ExposedAPI>(Symbol.for('rspeedy.api'), {
      config,
      debug: vi.fn(),
      exit,
      logger,
      version: '1.0.0',
    })

    exposeLynxConfig(api)
  },
})

describe('Preview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    })

    return () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      })
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      })
    }
  })

  test('preview with NODE_ENV=development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)
    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/hello-world/index.js',
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode(),
        ],
        environments: {
          lynx: {},
        },
        dev: {
          assetPrefix: 'http://example.com/',
        },
        server: {
          port: getRandomNumberInRange(3000, 60000),
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).toBeCalled()
    expect(renderUnicodeCompact).toBeCalledWith(
      'http://example.com/main.lynx.bundle',
    )

    await server.close()
    await vi.waitFor(() => {
      expect(exit).toBeCalledTimes(1)
    })
  })

  test('preview with port', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)

    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const port = getRandomNumberInRange(3000, 60000)

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/hello-world/index.js',
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode(),
        ],
        environments: {
          lynx: {},
        },
        dev: {
          assetPrefix: 'http://example.com:<port>/',
        },
        server: {
          port,
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).toBeCalled()
    expect(renderUnicodeCompact).toBeCalledWith(
      `http://example.com:${port}/main.lynx.bundle`,
    )

    await server.close()
    await vi.waitFor(() => {
      expect(exit).toBeCalledTimes(1)
    })
  })

  test('preview with custom schema', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)

    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const port = getRandomNumberInRange(3000, 60000)

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/hello-world/index.js',
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode({
            schema(url) {
              return `--${url}--`
            },
          }),
        ],
        environments: {
          lynx: {},
        },
        dev: {
          assetPrefix: 'http://example.com:<port>/',
        },
        server: {
          port,
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).toBeCalled()
    expect(renderUnicodeCompact).toBeCalledWith(
      `--http://example.com:${port}/main.lynx.bundle--`,
    )

    await server.close()
    await vi.waitFor(() => {
      expect(exit).toBeCalledTimes(1)
    })
  })

  test('preview without environment lynx', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)

    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/hello-world/index.js',
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode(),
        ],
        server: {
          port: getRandomNumberInRange(3000, 60000),
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).not.toBeCalled()

    await server.close()
    expect(exit).not.toBeCalled()
  })

  test('preview without lynx ignores custom environment routes', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)

    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        source: {
          entry: {
            main: './fixtures/hello-world/index.js',
          },
        },
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode(),
        ],
        environments: {
          custom: {},
        },
        dev: {
          assetPrefix: 'http://example.com/',
        },
        server: {
          port: getRandomNumberInRange(3000, 60000),
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).not.toBeCalled()

    await server.close()
    expect(exit).not.toBeCalled()
  })

  test('preview without routes does not print qrcode', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { renderUnicodeCompact } = await import('uqr')

    const { selectKey, isCancel } = await import('@clack/prompts')
    vi.mocked(selectKey).mockResolvedValue('foo')
    vi.mocked(isCancel).mockReturnValue(true)

    vi.mocked(renderUnicodeCompact).mockReturnValueOnce('<data>')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginStubRspeedyAPI(),
          pluginQRCode(),
        ],
        environments: {
          custom: {},
        },
        dev: {
          assetPrefix: 'http://example.com/',
        },
        server: {
          port: getRandomNumberInRange(3000, 50000),
        },
      },
    })

    const { server } = await rsbuild.preview({ checkDistDir: false })

    expect(renderUnicodeCompact).not.toBeCalled()

    await server.close()
  })
})
