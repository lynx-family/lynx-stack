// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest'

import type { Config } from '../../src/index.js'

describe('Config - Dev', () => {
  type Dev = Config['dev']

  test('empty', () => {
    assertType<Dev>(void 0)
    assertType<Dev>({})
  })

  test('assetPrefix', () => {
    assertType<Dev>({ assetPrefix: 'foo.com' })
    assertType<Dev>({ assetPrefix: 'example.com' })
    assertType<Dev>({ assetPrefix: true })
    assertType<Dev>({ assetPrefix: false })
  })

  test('client', () => {
    assertType<Dev>({ client: {} })
    assertType<Dev>({
      client: {
        websocketTransport: undefined,
      },
    })
    assertType<Dev>({
      client: {
        websocketTransport: '/foo',
      },
    })
  })

  test('hmr', () => {
    assertType<Dev>({ hmr: true })
    assertType<Dev>({ hmr: false })
  })

  test('liveReload', () => {
    assertType<Dev>({ liveReload: true })
    assertType<Dev>({ liveReload: false })
  })

  test('watchFiles', () => {
    assertType<Dev>({ watchFiles: { paths: '' } })
    assertType<Dev>({ watchFiles: { paths: [] } })
    assertType<Dev>({ watchFiles: { paths: ['foo', 'bar'] } })

    assertType<Dev>({ watchFiles: { paths: '', options: {} } })
    assertType<Dev>({
      watchFiles: { paths: '', options: { usePolling: false } },
    })
    assertType<Dev>({ watchFiles: { paths: '', options: { interval: 300 } } })

    assertType<Dev>({ watchFiles: [] })
    assertType<Dev>({ watchFiles: [{ paths: '' }] })
    assertType<Dev>({ watchFiles: [{ paths: [] }] })
    assertType<Dev>({ watchFiles: [{ paths: ['foo', 'bar'] }] })

    assertType<Dev>({ watchFiles: [{ paths: '', options: {} }] })
    assertType<Dev>({
      watchFiles: [{ paths: '', options: { usePolling: false } }],
    })
    assertType<Dev>({ watchFiles: [{ paths: '', options: { interval: 300 } }] })
  })

  test('writeToDisk', () => {
    assertType<Dev>({ writeToDisk: undefined })
    assertType<Dev>({ writeToDisk: true })
    assertType<Dev>({ writeToDisk: false })
    assertType<Dev>({ writeToDisk: () => false })
    assertType<Dev>({ writeToDisk: () => true })
    assertType<Dev>({ writeToDisk: (path) => path.includes('foo') })
  })

  test('progressBar', () => {
    assertType<Dev>({ progressBar: undefined })
    assertType<Dev>({ progressBar: false })
    assertType<Dev>({ progressBar: true })
    assertType<Dev>({ progressBar: { id: 'foo' } })
  })
})
