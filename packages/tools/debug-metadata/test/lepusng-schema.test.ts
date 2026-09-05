// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { LepusNGDebugInfo } from '../src/types.js';

// `@lynx-js/debug-metadata` is a schema-only package — `parseLepusNGDebugInfo`
// lives in the consumer plugin. The tests here cover schema invariants only.

describe('LepusNGDebugInfo schema', () => {
  test('JSON.parse round-trip preserves the lepusNG_debug_info envelope', () => {
    const original: LepusNGDebugInfo = {
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
    };
    const cloned = JSON.parse(JSON.stringify(original)) as LepusNGDebugInfo;
    expect(cloned).toEqual(original);
    expect(cloned.lepusNG_debug_info.function_info[0]?.function_name).toBe(
      'foo',
    );
  });
});
