// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, expectTypeOf, test } from 'vitest'

import type {
  ConfigExport,
  ConfigParams,
} from '../../src/config/defineConfig.js'
import type { Config } from '../../src/config/index.js'
import { defineConfig } from '../../src/index.js'

const configFn = () => ({} as Config)
const configAsyncFn = async () => ({} as Config)

describe('Config - defineConfig', () => {
  test('defineConfig type check', () => {
    expectTypeOf(defineConfig).parameter(0).toEqualTypeOf<ConfigExport>()
    expectTypeOf(defineConfig).returns.toEqualTypeOf<ConfigExport>()
  })

  test('defineConfig accepts Config object', () => {
    const config: Config = {}
    expectTypeOf(defineConfig(config)).toEqualTypeOf<Config>()
  })

  test('defineConfig accepts Promise<Config>', () => {
    const configPromise = Promise.resolve({} as Config)
    expectTypeOf(defineConfig(configPromise)).toEqualTypeOf<Promise<Config>>()
  })

  test('defineConfig accepts function returning Config', () => {
    expectTypeOf(defineConfig(configFn)).toEqualTypeOf<
      (params: ConfigParams) => Config
    >()
  })

  test('defineConfig accepts function returning Promise<Config>', () => {
    expectTypeOf(defineConfig(configAsyncFn)).toEqualTypeOf<
      (params: ConfigParams) => Promise<Config>
    >()
  })

  test('ConfigParams', () => {
    defineConfig(({ env, command }) => {
      assertType<string>(env)
      assertType<string>(command)
      return {}
    })
  })
})
