// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertType, describe, test } from 'vitest'

import type { Resolve } from '../../../src/index.js'

describe('Config - Resolve', () => {
  test('extensions', () => {
    assertType<Resolve>({})
    assertType<Resolve>({
      extensions: undefined,
    })
    assertType<Resolve>({
      extensions: [],
    })
    assertType<Resolve>({
      extensions: ['.ts', '.tsx', '.js', '.json'],
    })
    assertType<Resolve>({
      // @ts-expect-error should not use `{}`
      extensions: {},
    })
    assertType<Resolve>({
      // @ts-expect-error should not use non-string values
      extensions: [1, 2, 3],
    })
  })
})
