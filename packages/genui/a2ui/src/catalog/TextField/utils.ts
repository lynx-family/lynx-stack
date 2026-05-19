// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type TextFieldVariant =
  | 'longText'
  | 'number'
  | 'obscured'
  | 'shortText';

export const TEXT_FIELD_VARIANTS: readonly TextFieldVariant[] = [
  'longText',
  'number',
  'shortText',
  'obscured',
];

export type TextFieldInputType = 'number' | 'password' | 'text';

export function normalizeTextFieldVariant(
  variant: unknown,
  textFieldType?: unknown,
): TextFieldVariant {
  const preferred = typeof variant === 'string' ? variant : undefined;
  const fallback = typeof textFieldType === 'string'
    ? textFieldType
    : undefined;

  if (isTextFieldVariant(preferred)) return preferred;
  if (isTextFieldVariant(fallback)) return fallback;
  return 'shortText';
}

export function getTextFieldInputType(
  variant: TextFieldVariant,
): TextFieldInputType {
  if (variant === 'number') return 'number';
  if (variant === 'obscured') return 'password';
  return 'text';
}

export function normalizeTextFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'bigint'
  ) {
    return String(value);
  }

  return '';
}

export function isTextFieldValueValid(
  value: string,
  validationRegexp: unknown,
): boolean {
  if (typeof validationRegexp !== 'string' || validationRegexp.length === 0) {
    return true;
  }

  try {
    return new RegExp(validationRegexp).test(value);
  } catch {
    return true;
  }
}

function isTextFieldVariant(
  value: string | undefined,
): value is TextFieldVariant {
  return TEXT_FIELD_VARIANTS.includes(value as TextFieldVariant);
}
