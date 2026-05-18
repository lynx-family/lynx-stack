// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  fromSliderRatio,
  normalizeSliderLabel,
  normalizeSliderNumber,
  normalizeSliderRange,
  toSliderRatio,
  toSliderStepRatio,
} from '../src/catalog/Slider/utils.js';

describe('Slider utils', () => {
  test('normalizes numeric values', () => {
    expect(normalizeSliderNumber(42, 0)).toBe(42);
    expect(normalizeSliderNumber('3.5', 0)).toBe(3.5);
    expect(normalizeSliderNumber('bad', 7)).toBe(7);
    expect(normalizeSliderNumber(undefined, 7)).toBe(7);
  });

  test('normalizes invalid ranges to defaults', () => {
    expect(normalizeSliderRange(10, 20)).toEqual({ min: 10, max: 20 });
    expect(normalizeSliderRange(20, 10)).toEqual({ min: 0, max: 100 });
    expect(normalizeSliderRange(undefined, undefined)).toEqual({
      min: 0,
      max: 100,
    });
  });

  test('maps A2UI values to lynx-ui ratios', () => {
    const range = { min: 20, max: 120 };
    expect(toSliderRatio(20, range)).toBe(0);
    expect(toSliderRatio(70, range)).toBe(0.5);
    expect(toSliderRatio(120, range)).toBe(1);
    expect(toSliderRatio(200, range)).toBe(1);
  });

  test('maps lynx-ui ratios back to A2UI values', () => {
    const range = { min: 20, max: 120 };
    expect(fromSliderRatio(0, range)).toBe(20);
    expect(fromSliderRatio(0.5, range)).toBe(70);
    expect(fromSliderRatio(1, range)).toBe(120);
    expect(fromSliderRatio(1, range, 50)).toBe(120);
  });

  test('converts value step to ratio step', () => {
    const range = { min: 0, max: 100 };
    expect(toSliderStepRatio(5, range)).toBe(0.05);
    expect(toSliderStepRatio(0, range)).toBeUndefined();
    expect(toSliderStepRatio(undefined, range)).toBeUndefined();
  });

  test('rounds stepped values without floating point tails', () => {
    const range = { min: 0, max: 1 };
    expect(fromSliderRatio(0.3, range, 0.1)).toBe(0.3);
  });

  test('normalizes labels for display', () => {
    expect(normalizeSliderLabel('Volume')).toBe('Volume');
    expect(normalizeSliderLabel(7)).toBe('7');
    expect(normalizeSliderLabel(undefined)).toBe('');
    expect(normalizeSliderLabel({ path: '/label' })).toBe('');
  });
});
