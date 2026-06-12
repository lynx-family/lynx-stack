// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, test } from '@rstest/core'

import type { Resolve } from '../../../src/index.js'
import { assertType } from '../../assertType.js'

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
