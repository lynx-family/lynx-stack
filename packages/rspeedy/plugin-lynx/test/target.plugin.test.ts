// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

describe('pluginTarget', () => {
  test('the target should be es2017 in production', async () => {
    rstest.stubEnv('NODE_ENV', 'production')
    const rsbuild = await createStubRsbuild()
    const config = await rsbuild.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('the target should be es2017 in development', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const rsbuild = await createStubRsbuild()
    const config = await rsbuild.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('should be es2017', async () => {
    const rsbuild = await createStubRsbuild()
    const config = await rsbuild.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  // `web` must not use the `'web'` target: it makes Rsbuild inject its web HMR
  // runtime, which crashes the Lynx web main thread.
  test('Web', async () => {
    const rsbuild = await createStubRsbuild({
      environments: {
        web: {},
      },
    })

    const config = await rsbuild.unwrapConfig()

    expect(config.target).toEqual(['es2017'])
  })

  test('multiple environments', async () => {
    const rsbuild = await createStubRsbuild({
      environments: {
        web: {},
        lynx: {},
      },
    })

    const [webConfig, lynxConfig] = await rsbuild.initConfigs()

    expect(webConfig?.target).toEqual(['es2017'])
    expect(lynxConfig?.target).toEqual(['es2017'])
  })
})
