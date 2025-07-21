// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { createRepeaterUtility } from '../../plugin-utils/index.js';

describe('createRepeaterUtility', () => {
  it('repeats using count', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 3 });
    expect(fn('150ms')).toEqual({
      'transition-delay': '150ms, 150ms, 150ms',
    });
  });

  it('repeats using matchValue split', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity, transform',
    });
    expect(fn('200ms')).toEqual({
      'transition-delay': '200ms, 200ms',
    });
  });

  it('count overrides matchValue', () => {
    const fn = createRepeaterUtility('transition-delay', {
      count: 2,
      matchValue: 'opacity, transform, filter',
    });
    expect(fn('100ms')).toEqual({
      'transition-delay': '100ms, 100ms',
    });
  });

  it('returns null for invalid count (0)', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 0 });
    expect(fn('150ms')).toBeNull();
  });

  it('returns null for invalid count (NaN)', () => {
    const fn = createRepeaterUtility('transition-delay', {
      count: NaN,
    });
    expect(fn('150ms')).toBeNull();
  });

  it('returns null for empty matchValue', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: '',
    });
    expect(fn('150ms')).toBeNull();
  });

  it('returns null for matchValue with only empty segments', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: ' , , ',
    });
    expect(fn('150ms')).toBeNull();
  });

  it('returns null for non-string input value', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 2 });
    expect(fn(100)).toBeNull();
    expect(fn(null)).toBeNull();
    expect(fn(undefined)).toBeNull();
  });

  it('returns null if property is invalid', () => {
    const fn = createRepeaterUtility('', { count: 2 });
    expect(fn('150ms')).toBeNull();
  });

  it('treats complex matchValue as single item', () => {
    // CSS variables with commas should not be split - treated as single value
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'x, var(--a, y), z',
    });
    expect(fn('300ms')).toEqual({
      'transition-delay': '300ms',
    });
  });

  it('respects custom split and fill delimiters', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity|transform',
      splitDelimiter: '|',
      fillDelimiter: ' ',
    });
    expect(fn('200ms')).toEqual({
      'transition-delay': '200ms 200ms',
    });
  });
});
