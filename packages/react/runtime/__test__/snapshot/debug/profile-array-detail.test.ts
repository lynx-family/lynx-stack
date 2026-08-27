// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import {
  isLargeProfileArray,
  PROFILE_ARRAY_DETAIL_PREFIX_ITEMS,
  PROFILE_ARRAY_DETAIL_THRESHOLD,
  summarizeLargeProfileArrayChangedKeys,
  summarizeLargeProfileArrayKeys,
  summarizeLargeProfileArrayValue,
} from '../../../src/shared/profile-array-detail.js';

describe('profile array detail', () => {
  it('keeps the compatibility path through the threshold', () => {
    expect(isLargeProfileArray(new Array(PROFILE_ARRAY_DETAIL_THRESHOLD)))
      .toBe(false);
    expect(
      isLargeProfileArray(new Array(PROFILE_ARRAY_DETAIL_THRESHOLD + 1)),
    ).toBe(true);
    expect(isLargeProfileArray({ length: 10_000 })).toBe(false);
  });

  it('inspects only the configured index prefix', () => {
    const value = new Array<unknown>(10_000);
    value[0] = 1;
    value[PROFILE_ARRAY_DETAIL_PREFIX_ITEMS - 1] = 'last';
    value[PROFILE_ARRAY_DETAIL_PREFIX_ITEMS] = 'outside';
    Object.defineProperty(value, 'extra', {
      enumerable: true,
      value: 'outside-prefix',
    });

    expect(JSON.parse(summarizeLargeProfileArrayKeys(value))).toEqual({
      version: 1,
      type: 'array-prefix',
      length: 10_000,
      keys: ['0', String(PROFILE_ARRAY_DETAIL_PREFIX_ITEMS - 1)],
      omitted: 10_000 - PROFILE_ARRAY_DETAIL_PREFIX_ITEMS,
      tail: 'not-inspected',
    });

    const summary = JSON.parse(summarizeLargeProfileArrayValue(value));
    expect(summary).toEqual({
      version: 1,
      type: 'array',
      length: 10_000,
      detail: 'omitted',
    });
    expect(JSON.stringify(summary)).not.toContain('outside');
  });

  it('reports only shallow changes found in the inspected prefix', () => {
    const current = Array.from({ length: 10_000 }, (_, index) => ({
      index,
    }));
    const next = current.slice();
    next[0] = { index: 0 };
    next[10] = { index: 10 };
    next[PROFILE_ARRAY_DETAIL_PREFIX_ITEMS] = {
      index: PROFILE_ARRAY_DETAIL_PREFIX_ITEMS,
    };

    expect(
      JSON.parse(summarizeLargeProfileArrayChangedKeys(current, next)),
    ).toEqual({
      version: 1,
      type: 'array-prefix-diff',
      currentLength: 10_000,
      nextLength: 10_000,
      keys: ['0', '10'],
      omitted: 10_000 - PROFILE_ARRAY_DETAIL_PREFIX_ITEMS,
      tail: 'not-inspected',
    });
  });

  it('does not enumerate array items when summarizing values', () => {
    let ownKeysCalls = 0;
    const objectItem = new Proxy(
      { hidden: true },
      {
        ownKeys(target) {
          ownKeysCalls++;
          return Reflect.ownKeys(target);
        },
      },
    );
    const value = Array.from(
      { length: PROFILE_ARRAY_DETAIL_THRESHOLD + 1 },
      () => objectItem,
    );

    const summary = JSON.parse(summarizeLargeProfileArrayValue(value));
    expect(summary).toEqual({
      version: 1,
      type: 'array',
      length: PROFILE_ARRAY_DETAIL_THRESHOLD + 1,
      detail: 'omitted',
    });
    expect(ownKeysCalls).toBe(0);
  });

  it('omits current length when the previous state is not an array', () => {
    const next = Array.from(
      { length: PROFILE_ARRAY_DETAIL_THRESHOLD + 1 },
      (_, index) => index,
    );

    expect(
      JSON.parse(summarizeLargeProfileArrayChangedKeys(null, next)),
    ).toEqual({
      version: 1,
      type: 'array-prefix-diff',
      nextLength: PROFILE_ARRAY_DETAIL_THRESHOLD + 1,
      keys: Array.from(
        { length: PROFILE_ARRAY_DETAIL_PREFIX_ITEMS },
        (_, index) => String(index),
      ),
      omitted: PROFILE_ARRAY_DETAIL_THRESHOLD + 1
        - PROFILE_ARRAY_DETAIL_PREFIX_ITEMS,
      tail: 'not-inspected',
    });
  });
});
