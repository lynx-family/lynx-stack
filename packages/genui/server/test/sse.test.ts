// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { encodeSSE } from '../app/common/sse.js';

const decoder = new TextDecoder();

describe('encodeSSE', () => {
  test('prefixes every line in a multiline string payload', () => {
    const frame = encodeSSE(
      'delta',
      'first\r\nsecond\r\rfourth',
      { id: 7 },
    );

    expect(decoder.decode(frame)).toBe(
      'id: 7\nevent: delta\ndata: first\ndata: second\ndata: \ndata: fourth\n\n',
    );
  });

  test('keeps object payloads on a single JSON data line', () => {
    const frame = encodeSSE('done', { ok: true });

    expect(decoder.decode(frame)).toBe(
      'event: done\ndata: {"ok":true}\n\n',
    );
  });
});
