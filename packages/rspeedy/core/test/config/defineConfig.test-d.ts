// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expectTypeOf, test } from 'vitest'

import type { ConfigExport } from '../../src/config/defineConfig.js'
import { defineConfig } from '../../src/index.js'

describe('Config - defineConfig', () => {
  test('defineConfig type check', () => {
    expectTypeOf(defineConfig).parameter(0).toEqualTypeOf<ConfigExport>()

    expectTypeOf(defineConfig).returns.toEqualTypeOf<ConfigExport>()
  })
})
