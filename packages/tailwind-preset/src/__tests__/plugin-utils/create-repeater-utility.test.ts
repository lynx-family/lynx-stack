// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { createRepeaterUtility } from '../../plugin-utils/index.js';

describe('createRepeaterUtility: basics', () => {
  it('repeats using count', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 3 });
    expect(fn).not.toBeNull();
    expect(fn?.('150ms')).toEqual({
      'transition-delay': '150ms, 150ms, 150ms',
    });
  });

  it('returns null for invalid count (0)', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 0 });
    expect(fn).toBeNull();
  });

  it('returns null for invalid count (NaN)', () => {
    const fn = createRepeaterUtility('transition-delay', { count: NaN });
    expect(fn).toBeNull();
  });

  it('count overrides matchValue if both present', () => {
    const fn = createRepeaterUtility('transition-delay', {
      count: 2,
      matchValue: 'opacity, transform, filter',
    });
    expect(fn).not.toBeNull();
    expect(fn?.('100ms')).toEqual({
      'transition-delay': '100ms, 100ms',
    });
  });
});

describe('createRepeaterUtility: repeat using matchValue', () => {
  it('repeats based on comma-separated identifiers', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity, transform',
      splitDelimiter: ',',
    });
    expect(fn).not.toBeNull();
    expect(fn?.('200ms')).toEqual({
      'transition-delay': '200ms, 200ms',
    });
  });

  it('treats non-ident comma value as single fallback', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'x, var(--a, y), z',
    });
    expect(fn).not.toBeNull();
    expect(fn?.('300ms')).toEqual({
      'transition-delay': '300ms',
    });
  });

  it('returns null for empty string', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: '',
    });
    expect(fn).toBeNull();
  });

  it('returns null for matchValue with only empty segments', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: ' , , ',
    });
    expect(fn).toBeNull();
  });
});

describe('createRepeaterUtility: delimiters', () => {
  it('respects custom split and fill delimiters', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity|transform',
      splitDelimiter: '|',
      fillDelimiter: ' ',
    });
    expect(fn).not.toBeNull();
    expect(fn?.('200ms')).toEqual({
      'transition-delay': '200ms 200ms',
    });
  });
});

describe('skipIfSingleProperty', () => {
  it('returns null when repeatCount === 1 and skipIfSingleProperty is true (from matchValue)', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity',
      skipIfSingleProperty: true,
    });
    expect(fn).toBeNull();
  });

  it('returns null when repeatCount === 1 and skipIfSingleProperty is true (from count)', () => {
    const fn = createRepeaterUtility('transition-delay', {
      count: 1,
      skipIfSingleProperty: true,
    });
    expect(fn).toBeNull();
  });

  it('still returns a function if skipIfSingleProperty is false (default)', () => {
    const fn = createRepeaterUtility('transition-delay', {
      matchValue: 'opacity',
    });
    expect(fn).not.toBeNull();
    expect(fn?.('200ms')).toEqual({
      'transition-delay': '200ms',
    });
  });
});

describe('createRepeaterUtility: input validation', () => {
  it('returns null if css property is invalid', () => {
    const fn = createRepeaterUtility('', { count: 2 });
    expect(fn).toBeNull();
  });

  it('returns null if runtime input is not a string', () => {
    const fn = createRepeaterUtility('transition-delay', { count: 2 });
    expect(fn).not.toBeNull();
    expect(fn?.(100)).toBeNull();
    expect(fn?.(null)).toBeNull();
    expect(fn?.(undefined)).toBeNull();
  });
});
