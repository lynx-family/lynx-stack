// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { resolveAssetPrefixOrigin } from '../src/pluginLynxDebugMetadata.js'

describe('resolveAssetPrefixOrigin', () => {
  test('absolute URL with a <port> token keeps origin and substitutes port', () => {
    expect(resolveAssetPrefixOrigin('http://localhost:<port>/', 3020))
      .toBe('http://localhost:3020')
  })

  test('absolute URL with a path keeps origin and path, dropping trailing slash', () => {
    expect(resolveAssetPrefixOrigin('https://cdn.example.com/assets/', 0))
      .toBe('https://cdn.example.com/assets')
    expect(resolveAssetPrefixOrigin('http://localhost:<port>/sub/path/', 9000))
      .toBe('http://localhost:9000/sub/path')
  })

  test('path-only public path stays relative (no placeholder origin leaks)', () => {
    expect(resolveAssetPrefixOrigin('/assets/', 3020)).toBe('/assets')
  })

  test('relative public path is normalised to an absolute path', () => {
    expect(resolveAssetPrefixOrigin('assets/', 3020)).toBe('/assets')
  })

  test('empty root path yields undefined (nothing to prefix)', () => {
    expect(resolveAssetPrefixOrigin('/', 3020)).toBeUndefined()
  })

  test('unparsable prefix yields undefined instead of throwing', () => {
    expect(resolveAssetPrefixOrigin('http://', 3020)).toBeUndefined()
  })
})
