// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Plugins - emitOnErrors', () => {
  test('no DEBUG', async () => {
    vi.stubEnv('DEBUG', '')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.emitOnErrors).toBe(undefined)
  })

  test('DEBUG=rspeedy', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.emitOnErrors).toBe(true)
  })

  test('DEBUG=rspeedy,rsbuild', async () => {
    vi.stubEnv('DEBUG', 'rspeedy,rsbuild')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.emitOnErrors).toBe(true)
  })

  test('DEBUG=*', async () => {
    vi.stubEnv('DEBUG', '*')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.emitOnErrors).toBe(true)
  })

  test('DEBUG=foo,bar', async () => {
    vi.stubEnv('DEBUG', 'foo,bar')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.emitOnErrors).toBe(undefined)
  })
})
