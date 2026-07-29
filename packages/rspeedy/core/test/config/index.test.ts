// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import * as config from '../../src/config/index.js'

describe('Config Declaration', () => {
  test('should not export any JS', () => {
    expect(
      Object.getOwnPropertyNames(config)
        // rstest's bundler tags every ES module with `__esModule`.
        .filter(name => name !== '__esModule'),
    ).toHaveLength(0)
  })
})
