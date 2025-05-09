// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest'

import type { Source } from '../../../src/index.js'

describe('Config - source.preEntry', () => {
  test('preEntry', () => {
    assertType<Source>({
      preEntry: undefined,
    })

    assertType<Source>({
      preEntry: './src/polyfill.ts',
    })

    assertType<Source>({
      preEntry: ['./src/polyfill-a.ts', './src/polyfill-b.ts'],
    })
  })
})
