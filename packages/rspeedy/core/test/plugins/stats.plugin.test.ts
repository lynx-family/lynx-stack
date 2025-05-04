// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('stats plugin', () => {
  test('no DEBUG', async () => {
    vi.stubEnv('DEBUG', '')
    const rspeedy = await createStubRspeedy({})
    await rspeedy.unwrapConfig()

    const config = rspeedy.getRsbuildConfig()

    expect(config.performance?.profile).toBe(false)
  })

  test('DEBUG', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({})
    await rspeedy.unwrapConfig()

    const config = rspeedy.getRsbuildConfig()

    expect(config.performance?.profile).toBe(true)
  })

  test('override performance.profile', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({
      performance: { profile: false },
    })
    await rspeedy.unwrapConfig()

    const config = rspeedy.getRsbuildConfig()

    expect(config.performance?.profile).toBe(true)
  })
})
