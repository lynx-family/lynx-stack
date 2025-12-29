// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertType, describe, test } from 'vitest'

import type { Resolve } from '../../../src/index.js'

describe('Config - Resolve', () => {
  test('dedupe', () => {
    assertType<Resolve>({})
    assertType<Resolve>({
      dedupe: undefined,
    })
    assertType<Resolve>({
      dedupe: [],
    })
    assertType<Resolve>({
      dedupe: ['foo', 'bar'],
    })
    assertType<Resolve>({
      // @ts-expect-error should not use `{}`
      dedupe: {},
    })
  })
})
