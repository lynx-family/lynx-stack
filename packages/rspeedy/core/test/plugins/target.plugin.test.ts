// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('target.plugin', () => {
  test('the target should be es2017 in production', async () => {
    rstest.stubEnv('NODE_ENV', 'production')
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('the target should be es2017 in development', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('should be es2017', async () => {
    const rspeedy = await createStubRspeedy({})
    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  // `web` must not use the `'web'` target: it makes Rsbuild inject its web HMR
  // runtime, which crashes the Lynx web main thread.
  test('Web', async () => {
    const rspeedy = await createStubRspeedy({
      environments: {
        web: {},
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('multiple environments', async () => {
    const rspeedy = await createStubRspeedy({
      environments: {
        web: {},
        lynx: {},
      },
    })

    const [webConfig, lynxConfig] = await rspeedy.initConfigs()

    expect(webConfig?.target).toEqual(['es2017'])
    expect(lynxConfig?.target).toEqual(['es2017'])
  })
})
