// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  RsbuildPlugin,
  RsbuildPluginAPI,
  RsbuildPlugins,
} from '@rsbuild/core'
import { describe, test } from '@rstest/core'
import { expectTypeOf } from 'expect-type'

import type { Config } from '../../src/index.js'
import { assertType } from '../assertType.js'

describe('Config - Plugins', () => {
  test('custom plugins', () => {
    const pluginTest: RsbuildPlugin = {
      name: 'test',
      setup(api) {
        assertType<RsbuildPluginAPI>(api)
      },
    }

    assertType({ plugins: [pluginTest] })
  })

  test('inline plugins', () => {
    expectTypeOf<Config>({
      plugins: [
        {
          name: 'test',
          setup(api) {
            assertType<RsbuildPluginAPI>(api)
          },
        } satisfies RsbuildPlugin,
      ],
    }).toHaveProperty('plugins').toMatchTypeOf<
      RsbuildPlugins | undefined
    >()
  })
})
