// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { isDirectOrDeepEqual } from '../../src/utils.js';

describe('isDirectOrDeepEqual', () => {
  it('distinguishes undefined properties with different keys', () => {
    expect(isDirectOrDeepEqual(
      { a: undefined },
      { b: undefined },
    )).toBe(false);

    expect(isDirectOrDeepEqual(
      { value: { a: undefined } },
      { value: { b: undefined } },
    )).toBe(false);
  });

  it('compares matching undefined properties as equal', () => {
    expect(isDirectOrDeepEqual(
      { a: undefined },
      { a: undefined },
    )).toBe(true);

    expect(isDirectOrDeepEqual(
      { value: { a: undefined } },
      { value: { a: undefined } },
    )).toBe(true);
  });

  it('distinguishes undefined properties from null', () => {
    expect(isDirectOrDeepEqual(
      { a: undefined },
      { a: null },
    )).toBe(false);
  });

  it('does not conflate undefined with marker-like strings', () => {
    expect(isDirectOrDeepEqual(
      { a: undefined },
      { a: '\0u' },
    )).toBe(false);

    expect(isDirectOrDeepEqual(
      { a: '\0u' },
      { a: '\0u' },
    )).toBe(true);
  });

  it('compares nested objects regardless of key order', () => {
    expect(isDirectOrDeepEqual(
      { a: { x: 1, y: [2, 3] }, b: true },
      { b: true, a: { y: [2, 3], x: 1 } },
    )).toBe(true);

    expect(isDirectOrDeepEqual(
      { a: { x: 1, y: [2, 3] } },
      { a: { x: 1, y: [2, 4] } },
    )).toBe(false);
  });

  it('throws when the candidate new value is circular', () => {
    const newObj: Record<string, unknown> = {};
    newObj['self'] = newObj;
    const ancestors: object[] = [];

    expect(() => isDirectOrDeepEqual(newObj, {}, ancestors)).toThrow('Cannot compare circular structures');
    expect(ancestors).toEqual([]);
    expect(isDirectOrDeepEqual({ value: 1 }, { value: 1 }, ancestors)).toBe(true);
    expect(isDirectOrDeepEqual(newObj, newObj)).toBe(true);
  });

  it('checks all of the candidate new value after finding a difference', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(() =>
      isDirectOrDeepEqual(
        { changed: 2, nested: circular },
        { changed: 1, nested: circular },
      )
    ).toThrow('Cannot compare circular structures');
  });

  it('does not check the old value for circular references', () => {
    const oldObj: Record<string, unknown> = { value: 1 };
    oldObj['self'] = oldObj;

    expect(isDirectOrDeepEqual(
      { value: 2, self: {} },
      oldObj,
    )).toBe(false);
  });

  it('does not treat shared references as circular', () => {
    const shared = { value: 1 };

    expect(isDirectOrDeepEqual(
      { a: shared, b: shared },
      { a: { value: 1 }, b: { value: 1 } },
    )).toBe(true);
  });
});
