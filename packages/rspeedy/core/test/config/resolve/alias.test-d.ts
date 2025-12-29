// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assertType, describe, test } from 'vitest'

import type { Resolve } from '../../../src/index.js'

describe('Config - Resolve', () => {
  test('alias', () => {
    assertType<Resolve>({})
    assertType<Resolve>({
      alias: undefined,
    })
    assertType<Resolve>({
      alias: {},
    })
    assertType<Resolve>({
      alias: {
        foo: 'foo',
        'foo$': ['foo', 'foo1'],
      },
    })
    assertType<Resolve>({
      alias: {
        bar: false,
      },
    })
    assertType<Resolve>({
      alias: {
        // @ts-expect-error should not use `true`
        bar: true,
      },
    })
    assertType<Resolve>({
      alias: {
        // @ts-expect-error should not use `0`
        bar: 0,
      },
    })
  })
})
