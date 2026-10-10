// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { RsbuildDevServer, RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { LYNX_CONFIG } from '../src/config.js'
import { createBundleResolveMiddleware } from '../src/middleware/bundle-resolve.js'

interface StubCall {
  rewrittenUrl: string | undefined
  nextCalled: boolean
}

type Environments = Record<
  string,
  { source: { entry?: Record<string, unknown> } }
>

const DEFAULT_ENVIRONMENTS: Environments = {
  lynx: {
    source: {
      entry: {
        main: {},
      },
    },
  },
}

function createStubApi(
  resolveBundleFilename: (context: {
    entryName: string
    platform: string
  }) => string,
  environments: Environments = DEFAULT_ENVIRONMENTS,
): RsbuildPluginAPI {
  return {
    useExposed: (exposed: symbol) => {
      if (exposed !== LYNX_CONFIG) return undefined
      return { resolveBundleFilename }
    },
    getNormalizedConfig: () => ({
      environments,
    }),
  } as unknown as RsbuildPluginAPI
}

function createStubServer(
  assets: string[] | Record<string, string[]>,
): RsbuildDevServer {
  const byEnvironment = Array.isArray(assets) ? { lynx: assets } : assets
  return {
    environments: Object.fromEntries(
      Object.entries(byEnvironment).map(([environment, names]) => [
        environment,
        {
          getStats: async () => ({
            compilation: {
              assets: Object.fromEntries(names.map(name => [name, {}])),
            },
          }),
        },
      ]),
    ),
  } as unknown as RsbuildDevServer
}

async function run(
  middleware: ReturnType<typeof createBundleResolveMiddleware>,
  url: string | undefined,
  method = 'GET',
): Promise<StubCall> {
  return await new Promise((resolve) => {
    const req = { method, url } as IncomingMessage
    const next = () => {
      resolve({ rewrittenUrl: req.url, nextCalled: true })
    }
    middleware(req, {} as ServerResponse, next)
    // The middleware only rewrites `req.url` and calls `next()`, it never
    // ends the response itself.
  })
}

const HASH_TEMPLATE = (context: { entryName: string, platform: string }) =>
  `${context.entryName}.${context.platform}.[contenthash:8].bundle`

describe('createBundleResolveMiddleware', () => {
  test('rewrites the placeholder URL to the emitted asset', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(middleware, '/main.lynx.[contenthash:8].bundle')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.6e10a1f5.bundle')
  })

  test('rewrites the printed URL with the placeholders stripped', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(middleware, '/main.lynx.bundle?fullscreen=true')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe(
      '/main.lynx.6e10a1f5.bundle?fullscreen=true',
    )
  })

  test('keeps the query and the base prefix', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(
      middleware,
      '/base/main.lynx.%5Bcontenthash:8%5D.bundle?fullscreen=true',
    )

    expect(call.rewrittenUrl).toBe(
      '/base/main.lynx.6e10a1f5.bundle?fullscreen=true',
    )
  })

  test('passes through when the emitted asset is not there yet', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.bundle']),
    )

    const call = await run(middleware, '/main.lynx.[contenthash:8].bundle')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.[contenthash:8].bundle')
  })

  test('passes through paths that only contain a matching segment', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const prefix = await run(
      middleware,
      '/main.lynx.[contenthash:8].bundle/extra',
    )
    expect(prefix.rewrittenUrl).toBe(
      '/main.lynx.[contenthash:8].bundle/extra',
    )

    const suffix = await run(middleware, '/main.lynx.[contenthash:8].bundle2')
    expect(suffix.rewrittenUrl).toBe('/main.lynx.[contenthash:8].bundle2')

    const joined = await run(
      middleware,
      '/xmain.lynx.[contenthash:8].bundle/y',
    )
    expect(joined.rewrittenUrl).toBe('/xmain.lynx.[contenthash:8].bundle/y')
  })

  test('does nothing when no bundle filename has a placeholder', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(context =>
        `${context.entryName}.${context.platform}.bundle`
      ),
      createStubServer(['main.lynx.bundle']),
    )

    const call = await run(middleware, '/main.lynx.bundle')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.bundle')
  })

  test('resolves each environment when the printed paths are unique', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE, {
        lynx: { source: { entry: { main: {} } } },
        web: { source: { entry: { main: {} } } },
      }),
      createStubServer({
        lynx: ['main.lynx.11111111.bundle'],
        web: ['main.web.22222222.bundle'],
      }),
    )

    const lynx = await run(middleware, '/main.lynx.bundle')
    expect(lynx.rewrittenUrl).toBe('/main.lynx.11111111.bundle')

    const web = await run(middleware, '/main.web.bundle')
    expect(web.rewrittenUrl).toBe('/main.web.22222222.bundle')
  })

  test('rejects a template whose printed path collides across environments', () => {
    // Both environments would print `/main.bundle`, so the middleware could
    // not tell which environment's bundle a request resolves to.
    expect(() =>
      createBundleResolveMiddleware(
        createStubApi(
          context => `${context.entryName}.[contenthash:8].bundle`,
          {
            lynx: { source: { entry: { main: {} } } },
            web: { source: { entry: { main: {} } } },
          },
        ),
        createStubServer(['main.6e10a1f5.bundle']),
      )
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Duplicate stripped bundle request path "main.bundle". Include [platform] in \`output.filename.bundle\`, or otherwise make the paths unique.]`,
    )
  })

  test('passes through requests that are not GET or HEAD', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(middleware, '/main.lynx.bundle', 'POST')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.bundle')
  })

  test('passes through a request without a URL', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(middleware, undefined)

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBeUndefined()
  })

  test('passes through when the environment is absent from the server', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE),
      // The environment the patterns were built for is not part of the
      // running server.
      createStubServer({ web: ['main.lynx.6e10a1f5.bundle'] }),
    )

    const call = await run(middleware, '/main.lynx.bundle')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.bundle')
  })

  test('does nothing for an environment without entries', async () => {
    const middleware = createBundleResolveMiddleware(
      createStubApi(HASH_TEMPLATE, {
        lynx: { source: {} },
      }),
      createStubServer(['main.lynx.6e10a1f5.bundle']),
    )

    const call = await run(middleware, '/main.lynx.bundle')

    expect(call.nextCalled).toBe(true)
    expect(call.rewrittenUrl).toBe('/main.lynx.bundle')
  })
})
