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

function createStubApi(
  resolveBundleFilename: (context: {
    entryName: string
    platform: string
  }) => string,
): RsbuildPluginAPI {
  return {
    useExposed: (exposed: symbol) => {
      if (exposed !== LYNX_CONFIG) return undefined
      return { resolveBundleFilename }
    },
    getNormalizedConfig: () => ({
      environments: {
        lynx: {
          source: {
            entry: {
              main: {},
            },
          },
        },
      },
    }),
  } as unknown as RsbuildPluginAPI
}

function createStubServer(assets: string[]): RsbuildDevServer {
  return {
    environments: {
      lynx: {
        getStats: async () => ({
          compilation: {
            assets: Object.fromEntries(assets.map(name => [name, {}])),
          },
        }),
      },
    },
  } as unknown as RsbuildDevServer
}

async function run(
  middleware: ReturnType<typeof createBundleResolveMiddleware>,
  url: string,
): Promise<StubCall> {
  return await new Promise((resolve) => {
    const req = { method: 'GET', url } as IncomingMessage
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
})
