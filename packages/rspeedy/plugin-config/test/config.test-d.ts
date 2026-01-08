// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expectTypeOf, it } from 'vitest'

import type * as TypeConfig from '@lynx-js/type-config'

import type { Config } from '../src/pluginLynxConfig.js'

// Copied from https://github.com/type-challenges/type-challenges/issues/737#issuecomment-3486953045
type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => unknown : never
) extends (arg: infer I) => void ? I
  : never

type LastInUnion<T> = UnionToIntersection<
  T extends unknown ? () => T : never
> extends () => infer R ? R
  : never

type UnionToTuple<U, T extends unknown[] = []> = [U] extends [T[number]] ? T
  : UnionToTuple<U, [...T, LastInUnion<Exclude<U, T[number]>>]>

describe('config length', () => {
  it('type config compiler option should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof TypeConfig.CompilerOptions>['length']>()
      .toEqualTypeOf<26>()
  })
  it('type config config should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof TypeConfig.Config>['length']>()
      .toEqualTypeOf<120>()
  })
  it('pluginLynxConfig config should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof Config>['length']>()
      .toEqualTypeOf<145>()
  })
})
