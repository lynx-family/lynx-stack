// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import { isWorkletObj } from '../src/utils/isWorkletObject.js';

describe('isWorkletObj', () => {
  test('should return true in MAIN THREAD mode', () => {
    // @ts-expect-error Testing MAIN THREAD mode
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const original = globalThis.__MAIN_THREAD__;
    // @ts-expect-error Testing MAIN THREAD mode
    globalThis.__MAIN_THREAD__ = true;

    const result = isWorkletObj({});

    // @ts-expect-error Restore
    globalThis.__MAIN_THREAD__ = original;

    expect(result).toBe(true);
  });

  test('should return true for object with _wkltId', () => {
    const worklet = {
      _wkltId: 'test:worklet:1',
    };

    expect(isWorkletObj(worklet)).toBe(true);
  });

  test('should return false for null', () => {
    expect(isWorkletObj(null)).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(isWorkletObj(undefined)).toBe(false);
  });

  test('should return false for object without _wkltId', () => {
    const notWorklet = {
      someProperty: 'value',
    };

    expect(isWorkletObj(notWorklet)).toBe(false);
  });

  test('should return false for primitive values', () => {
    expect(isWorkletObj(123)).toBe(false);
    expect(isWorkletObj('string')).toBe(false);
    expect(isWorkletObj(true)).toBe(false);
  });

  test('should return false for empty object', () => {
    expect(isWorkletObj({})).toBe(false);
  });

  test('should return true for object with _wkltId even if it has other properties', () => {
    const worklet = {
      _wkltId: 'test:worklet:1',
      _execId: 123,
      otherProp: 'value',
    };

    expect(isWorkletObj(worklet)).toBe(true);
  });

  test('should return false for array', () => {
    expect(isWorkletObj([])).toBe(false);
    expect(isWorkletObj([1, 2, 3])).toBe(false);
  });

  test('should return false for function', () => {
    const fn = () => {};
    expect(isWorkletObj(fn)).toBe(false);
  });

  test('should handle object with _wkltId as falsy value', () => {
    const worklet = {
      _wkltId: '',
    };

    // Still has the property, so should return true
    expect(isWorkletObj(worklet)).toBe(true);
  });
});
