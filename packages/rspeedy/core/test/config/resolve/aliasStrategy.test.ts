// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('Config - Resolve.aliasStrategy', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.aliasStrategy).toBeUndefined()
  })

  test('resolve.aliasStrategy with prefer-tsconfig', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        aliasStrategy: 'prefer-tsconfig',
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.aliasStrategy).toBe('prefer-tsconfig')
  })

  test('resolve.aliasStrategy with prefer-alias', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        aliasStrategy: 'prefer-alias',
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.aliasStrategy).toBe('prefer-alias')
  })
})
