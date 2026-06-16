// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Config - mode', () => {
  test('NODE_ENV=test', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('none')
  })

  test('NODE_ENV=production defaults', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('production')
  })

  test('NODE_ENV=development defaults', async () => {
    rstest.stubEnv('NODE_ENV', 'development')

    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('development')
  })

  test('production mode: "none"', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    const rspeedy = await createStubRspeedy({
      mode: 'none',
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('none')
  })

  test('development mode: "none"', async () => {
    rstest.stubEnv('NODE_ENV', 'development')

    const rspeedy = await createStubRspeedy({
      mode: 'none',
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('none')
  })

  test('production mode: "development"', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    const rspeedy = await createStubRspeedy({
      mode: 'development',
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('development')
  })

  test('development mode: "production"', async () => {
    rstest.stubEnv('NODE_ENV', 'development')

    const rspeedy = await createStubRspeedy({
      mode: 'production',
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.mode).toBe('production')
  })
})
