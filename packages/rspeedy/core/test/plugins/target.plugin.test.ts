// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('target.plugin', () => {
  test('the target should be es2015 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2015'])
  })

  test('the target should be es2019 in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2019'])
  })

  test('should be es2019', async () => {
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2019'])
  })

  test('Web', async () => {
    const rspeedy = await createStubRspeedy({
      environments: {
        web: {},
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2019', 'web'])
  })

  test('multiple environments', async () => {
    const rspeedy = await createStubRspeedy({
      environments: {
        web: {},
        lynx: {},
      },
    })

    const [webConfig, lynxConfig] = await rspeedy.initConfigs()

    expect(webConfig?.target).toEqual(['es2019', 'web'])
    expect(lynxConfig?.target).toEqual(['es2019'])
  })
})
