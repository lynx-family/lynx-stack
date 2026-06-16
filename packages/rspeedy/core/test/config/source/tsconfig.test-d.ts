// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import { describe, test } from '@rstest/core'

import type { Source } from '../../../src/index.js'
import { assertType } from '../../assertType.js'

describe('Config - source.tsconfigPath', () => {
  test('tsconfigPath with string', () => {
    assertType<Source>({
      tsconfigPath: 'foo',
    })

    assertType<Source>({
      tsconfigPath: path.join(__dirname, 'tsconfig.custom.json'),
    })
  })
})
