// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { resolveLazyBundleFetcher } from '../src/resolveLazyBundleFetcher.js'

describe('resolveLazyBundleFetcher', () => {
  const originalEnv = process.env['REACT_LAZY_BUNDLE_FETCHER']
  beforeEach(() => {
    delete process.env['REACT_LAZY_BUNDLE_FETCHER']
  })
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['REACT_LAZY_BUNDLE_FETCHER']
    } else {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = originalEnv
    }
  })

  describe('default behavior (no env override)', () => {
    test('undefined engineVersion → QueryComponent', () => {
      expect(resolveLazyBundleFetcher(undefined)).toBe('QueryComponent')
    })

    test('engineVersion below 3.8 → QueryComponent', () => {
      expect(resolveLazyBundleFetcher('3.7')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('3.7.9')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('2.16')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('3.0')).toBe('QueryComponent')
    })

    test('engineVersion at or above 3.8 → FetchBundle', () => {
      expect(resolveLazyBundleFetcher('3.8')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('3.8.0')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('3.8.1')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('3.9')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('4.0')).toBe('FetchBundle')
    })

    test('multi-digit minor compares numerically (3.10 > 3.8)', () => {
      expect(resolveLazyBundleFetcher('3.10')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('3.10.5')).toBe('FetchBundle')
    })

    test('non-numeric version → QueryComponent (NaN guard)', () => {
      expect(resolveLazyBundleFetcher('foo')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('3.x')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('latest')).toBe('QueryComponent')
    })
  })

  describe('REACT_LAZY_BUNDLE_FETCHER env override', () => {
    test('=FetchBundle with sufficient version → FetchBundle', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'FetchBundle'
      expect(resolveLazyBundleFetcher('3.8')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('4.0')).toBe('FetchBundle')
    })

    test('=FetchBundle with insufficient version → throws', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'FetchBundle'
      expect(() => resolveLazyBundleFetcher('3.7')).toThrow(
        /requires engineVersion >= 3\.8/,
      )
    })

    test('=FetchBundle with undefined version → throws (mentions <unset>)', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'FetchBundle'
      expect(() => resolveLazyBundleFetcher(undefined)).toThrow(/<unset>/)
    })

    test('=QueryComponent forces legacy path even on 3.8+', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'QueryComponent'
      expect(resolveLazyBundleFetcher('3.8')).toBe('QueryComponent')
      expect(resolveLazyBundleFetcher('4.0')).toBe('QueryComponent')
    })

    test('=QueryComponent with insufficient version → QueryComponent', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'QueryComponent'
      expect(resolveLazyBundleFetcher('3.7')).toBe('QueryComponent')
    })

    test('unrecognized override value falls through to default', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = 'something-else'
      expect(resolveLazyBundleFetcher('3.8')).toBe('FetchBundle')
      expect(resolveLazyBundleFetcher('3.7')).toBe('QueryComponent')
    })

    test('empty string override → falls through to default', () => {
      process.env['REACT_LAZY_BUNDLE_FETCHER'] = ''
      expect(resolveLazyBundleFetcher('3.8')).toBe('FetchBundle')
    })
  })
})
