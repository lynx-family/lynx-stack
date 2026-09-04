// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { isDebug } from '../src/debug.js'

describe('isDebug', () => {
  test('accepts the lynx namespace and the rspeedy one', () => {
    for (const value of ['lynx', 'rspeedy', 'lynx,rsbuild', '*']) {
      rstest.stubEnv('DEBUG', value)
      try {
        expect(isDebug(), value).toBe(true)
      } finally {
        rstest.unstubAllEnvs()
      }
    }
  })

  test('ignores other namespaces', () => {
    rstest.stubEnv('DEBUG', 'rslib')
    try {
      expect(isDebug()).toBe(false)
    } finally {
      rstest.unstubAllEnvs()
    }
  })
})
