// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as TypeConfig from '@upupming/type-config'
import { describe, expectTypeOf, it } from 'vitest'

import type {
  LynxCompilerOptions,
  LynxConfig,
  PluginReactLynxOptions,
  ReactLynxDefaultCompilerOptions,
  ReactLynxDefaultLynxConfig,
  ReactLynxOptions,
  ResolvedPluginReactLynxOptions,
} from '../src/index.js'

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

describe('Type exports', () => {
  it('should export type config types', () => {
    expectTypeOf<LynxCompilerOptions>().toEqualTypeOf<
      TypeConfig.CompilerOptions
    >()
    expectTypeOf<LynxConfig>().toEqualTypeOf<TypeConfig.Config>()
  })
})

describe('PluginReactLynxOptions', () => {
  it('should allow all configs from `@upupming/type-config`', () => {
    expectTypeOf<TypeConfig.CompilerOptions>().toExtend<
      PluginReactLynxOptions
    >()
    expectTypeOf<TypeConfig.Config>().toExtend<PluginReactLynxOptions>()
  })
  it('should allow ReactLynx specific config', () => {
    expectTypeOf<ReactLynxOptions>().toExtend<PluginReactLynxOptions>()
  })
  it('different configs should have no intersection', () => {
    expectTypeOf<
      (keyof ReactLynxOptions) & (keyof TypeConfig.CompilerOptions)
    >().toEqualTypeOf<never>()
    expectTypeOf<(keyof ReactLynxOptions) & (keyof TypeConfig.Config)>()
      .toEqualTypeOf<never>()
  })
  it('should have all default field defined', () => {
    expectTypeOf<undefined>().toExtend<
      // @ts-expect-error No any default filed is undefined
      ResolvedPluginReactLynxOptions[
        (
          | (keyof ReactLynxDefaultCompilerOptions)
          | (keyof ReactLynxDefaultLynxConfig)
        )
      ]
    >()
  })
})

describe('ReactLynx default config value', () => {
  it('should have default configs', () => {
    expectTypeOf<keyof ReactLynxDefaultCompilerOptions>().toEqualTypeOf<
      | 'debugInfoOutside'
      | 'defaultDisplayLinear'
      | 'enableCSSInvalidation'
      | 'enableCSSSelector'
      | 'enableRemoveCSSScope'
      | 'targetSdkVersion'
    >()
    expectTypeOf<keyof ReactLynxDefaultLynxConfig>().toEqualTypeOf<
      | 'enableA11y'
      | 'enableAccessibilityElement'
      | 'enableCSSInheritance'
      | 'enableNewGesture'
      | 'removeDescendantSelectorScope'
    >()
  })
})

describe('config length', () => {
  it('type config compiler option should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof TypeConfig.CompilerOptions>['length']>()
      .toEqualTypeOf<38>()
  })
  it('type config config should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof TypeConfig.Config>['length']>()
      .toEqualTypeOf<130>()
  })
  it('pluginReactLynx options should have expected length', () => {
    expectTypeOf<UnionToTuple<keyof PluginReactLynxOptions>['length']>()
      .toEqualTypeOf<174>()
  })
})
