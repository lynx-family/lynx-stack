// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core'

import { parseLepusNGDebugInfo } from '../src/collectors/bytecode-debug-info.js'

const validEnvelope = {
  lepusNG_debug_info: {
    function_source: 'function foo(){}',
    function_number: 1,
    end_line_num: 1,
    function_info: [
      {
        function_id: 0,
        function_name: 'foo',
        file_name: 'main-thread.js',
        line_number: 1,
        column_number: 0,
        pc2line_len: 0,
        pc2line_buf: [],
        line_col: [],
        pc2caller_info: {},
      },
    ],
  },
}

describe('parseLepusNGDebugInfo', () => {
  test('returns undefined for empty string', () => {
    expect(parseLepusNGDebugInfo('')).toBeUndefined()
  })

  test('returns undefined for invalid JSON', () => {
    expect(parseLepusNGDebugInfo('{ not json')).toBeUndefined()
  })

  test('returns undefined when the envelope is missing', () => {
    expect(parseLepusNGDebugInfo(JSON.stringify({}))).toBeUndefined()
    expect(
      parseLepusNGDebugInfo(JSON.stringify({ some_other_key: 1 })),
    ).toBeUndefined()
  })

  test('returns the parsed payload when the envelope is present', () => {
    const parsed = parseLepusNGDebugInfo(JSON.stringify(validEnvelope))
    expect(parsed).toEqual(validEnvelope)
    expect(parsed?.lepusNG_debug_info.function_info[0]?.function_name).toBe(
      'foo',
    )
  })
})
