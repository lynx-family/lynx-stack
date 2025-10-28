// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ProxyOptions } from '@rsbuild/core'
import { assertType, describe, test } from 'vitest'

import type { Server } from '../../src/index.js'

describe('Config - Server', () => {
  test('server.base', () => {
    assertType<Server>({})
    assertType<Server>({ base: '/foo' })
  })

  test('server.compress', () => {
    assertType<Server>({})
    assertType<Server>({ compress: undefined })
    assertType<Server>({ compress: false })
    assertType<Server>({ compress: true })
    assertType<Server>({ compress: { level: 1 } })
    assertType<Server>({
      compress: {
        filter: (req, res) => {
          assertType<IncomingMessage>(req)
          assertType<ServerResponse>(res)
          return true
        },
      },
    })
  })

  test('server.cors', () => {
    assertType<Server>({})
    assertType<Server>({ cors: undefined })
    assertType<Server>({ cors: false })
    assertType<Server>({ cors: true })
    assertType<Server>({ cors: { origin: 'https://example.com' } })
    assertType<Server>({
      cors: {
        origin: (origin, callback) => {
          assertType<string | undefined>(origin)
          callback(null, '*')
        },
        credentials: true,
      },
    })
  })

  test('server.headers', () => {
    assertType<Server>({})
    assertType<Server>({
      headers: {
        'foo': 'bar',
      },
    })
    assertType<Server>({
      headers: {
        'foo': ['bar'],
        bar: 'baz',
      },
    })
  })

  test('server.host', () => {
    assertType<Server>({})
    assertType<Server>({ host: undefined })
    assertType<Server>({ host: 'example.com' })
    assertType<Server>({ host: '0.0.0.0' })
  })

  test('server.port', () => {
    assertType<Server>({})
    assertType<Server>({ port: undefined })
    assertType<Server>({ port: 0 })
    assertType<Server>({ port: 8000 })
  })

  test('server.strictPort', () => {
    assertType<Server>({})
    assertType<Server>({ strictPort: undefined })
    assertType<Server>({ strictPort: false })
    assertType<Server>({ strictPort: true })
  })

  test('server.proxy', () => {
    assertType<Server>({})
    assertType<Server>({ proxy: undefined })
    assertType<Server>({ proxy: { '/api': 'https://nodejs.org' } })
    assertType<Server>({
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          pathRewrite: { '^/api': '' },
        },
      },
    })
    assertType<Server>({
      proxy: {
        '/rspeedy-hmr': {
          target: 'http://localhost:3000',
          ws: true,
        },
      },
    })
    assertType<Server>({
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          bypass(req, res, proxyOptions) {
            assertType<IncomingMessage>(req)
            assertType<ServerResponse>(res)
            assertType<ProxyOptions>(proxyOptions)
            return ''
          },
        },
      },
    })
    assertType<Server>({
      proxy: [
        {
          context: ['/auth', '/api'],
          target: 'http://localhost:3000',
        },
      ],
    })
  })
})
