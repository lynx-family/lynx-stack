// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import { offsetSourceMapLines } from '../src/loader.js';

describe('loader', () => {
  test('offsets generated source map lines when cssId wraps CSS content', () => {
    expect(
      offsetSourceMapLines({
        version: 3,
        sources: ['index.ttss'],
        names: [],
        mappings: 'AAAA;AACA;AACA',
      }, 1),
    ).toEqual({
      version: 3,
      sources: ['index.ttss'],
      names: [],
      mappings: ';AAAA;AACA;AACA',
    });
  });

  test('keeps empty source maps unchanged', () => {
    const sourceMap = {
      version: 3,
      sources: ['index.ttss'],
      names: [],
      mappings: '',
    };

    expect(offsetSourceMapLines(sourceMap, 1)).toBe(sourceMap);
  });
});
