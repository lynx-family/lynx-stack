// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertType, describe, test } from 'vitest'

import type { Resolve } from '../../../src/index.js'

describe('Config - Resolve.aliasStrategy', () => {
  test('aliasStrategy', () => {
    assertType<Resolve>({})
    assertType<Resolve>({
      aliasStrategy: undefined,
    })
    assertType<Resolve>({
      aliasStrategy: 'prefer-tsconfig',
    })
    assertType<Resolve>({
      aliasStrategy: 'prefer-alias',
    })
    assertType<Resolve>({
      // @ts-expect-error should not use invalid string
      aliasStrategy: 'invalid-strategy',
    })
    assertType<Resolve>({
      // @ts-expect-error should not use number
      aliasStrategy: 123,
    })
  })
})
