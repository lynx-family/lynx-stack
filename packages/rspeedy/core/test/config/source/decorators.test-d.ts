// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, test } from '@rstest/core'

import type { Source } from '../../../src/index.js'
import { assertType } from '../../assertType.js'

describe('Config - source.decorators', () => {
  test('version: 2022-03', () => {
    assertType<Source>({
      decorators: {
        version: '2022-03',
      },
    })
  })

  test('version: legacy', () => {
    assertType<Source>({
      decorators: {
        version: 'legacy',
      },
    })
  })
})
