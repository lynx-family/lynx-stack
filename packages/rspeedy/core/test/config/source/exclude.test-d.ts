// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, test } from '@rstest/core'

import type { Source } from '../../../src/index.js'
import { assertType } from '../../assertType.js'

describe('Config - source.exclude', () => {
  test('exclude with string[]', () => {
    assertType<Source>({
      exclude: [
        'foo',
        'foo/bar',
      ],
    })
  })

  test('exclude with RegExp[]', () => {
    assertType<Source>({
      exclude: [
        /foo/,
        /foo\/bar/,
      ],
    })
  })

  test('exclude with (RegExp | string)[]', () => {
    assertType<Source>({
      exclude: [
        /foo/,
        'foo',
        'foo/bar',
        /foo\/bar/,
      ] as const,
    })
  })

  test('exclude with object', () => {
    assertType<Source>({
      exclude: [
        { and: ['foo', /bar/], or: [{ not: [{ and: ['baz'] }] }] },
        { or: [/react/] },
        { not: /core-js/ },
      ],
    })
  })
})
