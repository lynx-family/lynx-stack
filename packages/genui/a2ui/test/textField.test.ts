// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  getTextFieldInputType,
  isTextFieldValueValid,
  normalizeTextFieldValue,
  normalizeTextFieldVariant,
} from '../src/catalog/TextField/utils.js';

describe('TextField utils', () => {
  test('normalizes supported variants', () => {
    expect(normalizeTextFieldVariant('shortText')).toBe('shortText');
    expect(normalizeTextFieldVariant('longText')).toBe('longText');
    expect(normalizeTextFieldVariant('number')).toBe('number');
    expect(normalizeTextFieldVariant('obscured')).toBe('obscured');
  });

  test('falls back to textFieldType for composer compatibility', () => {
    expect(normalizeTextFieldVariant(undefined, 'longText')).toBe('longText');
    expect(normalizeTextFieldVariant('bad', 'obscured')).toBe('obscured');
  });

  test('defaults unknown variants to shortText', () => {
    expect(normalizeTextFieldVariant(undefined)).toBe('shortText');
    expect(normalizeTextFieldVariant('email')).toBe('shortText');
  });

  test('maps variants to lynx-ui input types', () => {
    expect(getTextFieldInputType('shortText')).toBe('text');
    expect(getTextFieldInputType('longText')).toBe('text');
    expect(getTextFieldInputType('number')).toBe('number');
    expect(getTextFieldInputType('obscured')).toBe('password');
  });

  test('normalizes field values for controlled input rendering', () => {
    expect(normalizeTextFieldValue(undefined)).toBe('');
    expect(normalizeTextFieldValue(null)).toBe('');
    expect(normalizeTextFieldValue(42)).toBe('42');
    expect(normalizeTextFieldValue('Lynx')).toBe('Lynx');
    expect(normalizeTextFieldValue({ path: '/form/name' })).toBe('');
  });

  test('validates values with validationRegexp', () => {
    expect(isTextFieldValueValid('123', '^\\d+$')).toBe(true);
    expect(isTextFieldValueValid('abc', '^\\d+$')).toBe(false);
  });

  test('ignores absent or invalid validationRegexp values', () => {
    expect(isTextFieldValueValid('abc', undefined)).toBe(true);
    expect(isTextFieldValueValid('abc', '')).toBe(true);
    expect(isTextFieldValueValid('abc', '[')).toBe(true);
  });
});
