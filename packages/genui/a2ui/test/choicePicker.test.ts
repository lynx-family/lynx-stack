// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  filterChoicePickerOptions,
  normalizeChoicePickerDisplayStyle,
  normalizeChoicePickerOptions,
  normalizeChoicePickerValue,
  normalizeChoicePickerVariant,
  toggleChoicePickerValue,
} from '../src/catalog/ChoicePicker/utils.js';

describe('ChoicePicker utils', () => {
  const options = [
    { label: 'Old Jinshan', value: 'sf' },
    { label: 'Tokyo', value: 'tokyo' },
    { label: 'Paris', value: 'paris' },
  ];

  test('normalizes variants with the Composer alias', () => {
    expect(normalizeChoicePickerVariant('multipleSelection')).toBe(
      'multipleSelection',
    );
    expect(normalizeChoicePickerVariant('multiSelect')).toBe(
      'multipleSelection',
    );
    expect(normalizeChoicePickerVariant('mutuallyExclusive')).toBe(
      'mutuallyExclusive',
    );
    expect(normalizeChoicePickerVariant('unknown')).toBe('mutuallyExclusive');
  });

  test('normalizes display style', () => {
    expect(normalizeChoicePickerDisplayStyle('chips')).toBe('chips');
    expect(normalizeChoicePickerDisplayStyle('checkbox')).toBe('checkbox');
    expect(normalizeChoicePickerDisplayStyle('bad')).toBe('checkbox');
  });

  test('normalizes options and removes duplicates', () => {
    expect(
      normalizeChoicePickerOptions([
        { label: 'Tokyo', value: 'tokyo' },
        { label: '', value: 'paris' },
        { label: 'Duplicate', value: 'tokyo' },
        { label: 'Missing value' },
        null,
      ]),
    ).toEqual([
      { label: 'Tokyo', value: 'tokyo' },
      { label: 'paris', value: 'paris' },
    ]);
  });

  test('normalizes selected values against available options', () => {
    expect(
      normalizeChoicePickerValue(['tokyo', 'tokyo', 'missing', 1], options),
    ).toEqual(['tokyo']);
    expect(normalizeChoicePickerValue('paris', options)).toEqual(['paris']);
  });

  test('toggles multiple selection values', () => {
    expect(
      toggleChoicePickerValue(['tokyo'], 'paris', 'multipleSelection'),
    ).toEqual(['tokyo', 'paris']);
    expect(
      toggleChoicePickerValue(['tokyo', 'paris'], 'tokyo', 'multipleSelection'),
    ).toEqual(['paris']);
  });

  test('replaces mutually exclusive values', () => {
    expect(
      toggleChoicePickerValue(['tokyo', 'paris'], 'sf', 'mutuallyExclusive'),
    ).toEqual(['sf']);
  });

  test('filters options by label or value', () => {
    expect(filterChoicePickerOptions(options, 'tok')).toEqual([
      { label: 'Tokyo', value: 'tokyo' },
    ]);
    expect(filterChoicePickerOptions(options, 'sf')).toEqual([
      { label: 'Old Jinshan', value: 'sf' },
    ]);
    expect(filterChoicePickerOptions(options, ' ')).toEqual(options);
  });
});
