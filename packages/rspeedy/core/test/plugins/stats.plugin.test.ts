// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('stats plugin', () => {
  test('no DEBUG', async () => {
    rstest.stubEnv('DEBUG', '')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBeUndefined()
  })

  test('DEBUG', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(true)
  })

  test('override performance.profile', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({
      performance: { profile: false },
    })

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(false)
  })
})
