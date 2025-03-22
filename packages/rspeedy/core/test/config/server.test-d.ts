// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest'

import type { Server } from '../../src/index.js'

describe('Config - Server', () => {
  test('server.base', () => {
    assertType<Server>({})
    assertType<Server>({ base: '/foo' })
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
})
