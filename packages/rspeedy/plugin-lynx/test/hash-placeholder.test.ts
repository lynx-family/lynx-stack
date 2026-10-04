// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import {
  hasHashPlaceholder,
  hashPlaceholderToRegExp,
  stripHashPlaceholders,
} from '../src/utils/hash-placeholder.js'

describe('hasHashPlaceholder', () => {
  test.each([
    ['[name].[platform].[contenthash:8].bundle', true],
    ['[name].[platform].[hash].bundle', true],
    ['[name].[platform].[fullhash:16].bundle', true],
    ['[name].[platform].[chunkhash].bundle', true],
    ['[contenthash].bundle', true],
    ['[name].[platform].bundle', false],
    ['[name].bundle', false],
    ['[contenthashx].bundle', false],
  ])('%s -> %s', (template, expected) => {
    expect(hasHashPlaceholder(template)).toBe(expected)
  })
})

describe('stripHashPlaceholders', () => {
  test.each([
    ['main.lynx.[contenthash:8].bundle', 'main.lynx.bundle'],
    ['main.lynx.[hash].bundle', 'main.lynx.bundle'],
    ['main.lynx.[fullhash:16].bundle', 'main.lynx.bundle'],
    ['main.lynx.bundle', 'main.lynx.bundle'],
  ])('%s -> %s', (template, expected) => {
    expect(stripHashPlaceholders(template)).toBe(expected)
  })

  test('removes a placeholder at the start of the template', () => {
    expect(stripHashPlaceholders('[contenthash:8].main.bundle')).toBe(
      'main.bundle',
    )
  })
})

describe('hashPlaceholderToRegExp', () => {
  test('matches the emitted name of a [contenthash:8] template', () => {
    const regexp = hashPlaceholderToRegExp('main.lynx.[contenthash:8].bundle')

    expect(regexp.test('main.lynx.6e10a1f5.bundle')).toBe(true)
    expect(regexp.test('main.lynx.00000000.bundle')).toBe(true)

    // A digest of a different length does not match.
    expect(regexp.test('main.lynx.6e10a1f.bundle')).toBe(false)
    expect(regexp.test('main.lynx.6e10a1f55.bundle')).toBe(false)
    // The verbatim placeholder is not a hex digest.
    expect(regexp.test('main.lynx.[contenthash:8].bundle')).toBe(false)
    // Uppercase hex is not emitted.
    expect(regexp.test('main.lynx.6E10A1F5.bundle')).toBe(false)
  })

  test('a placeholder without a length matches any hex digest', () => {
    const regexp = hashPlaceholderToRegExp('main.lynx.[contenthash].bundle')

    expect(regexp.test('main.lynx.6e10a1f5.bundle')).toBe(true)
    expect(regexp.test('main.lynx.6e10a1f5d3c2b1a0.bundle')).toBe(true)
    expect(regexp.test('main.lynx.bundle')).toBe(false)
  })

  test('escapes regex metacharacters in the literal parts', () => {
    const regexp = hashPlaceholderToRegExp('main(1).+lynx.[hash].bundle')

    expect(regexp.test('main(1).+lynx.ab12cd34.bundle')).toBe(true)
    expect(regexp.test('mainX1X+lynx.ab12cd34.bundle')).toBe(false)
  })

  test('supports multiple placeholders', () => {
    const regexp = hashPlaceholderToRegExp(
      'main.lynx.[fullhash:4].[contenthash:8].bundle',
    )

    expect(regexp.test('main.lynx.beef.6e10a1f5.bundle')).toBe(true)
    expect(regexp.test('main.lynx.beef.6e10a1f.bundle')).toBe(false)
    expect(regexp.test('main.lynx.bee.6e10a1f5.bundle')).toBe(false)
  })
})
