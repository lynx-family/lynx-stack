// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ChoicePickerOption {
  label: string;
  value: string;
}

export type ChoicePickerVariant =
  | 'multipleSelection'
  | 'mutuallyExclusive';

export type ChoicePickerDisplayStyle = 'checkbox' | 'chips';

export function normalizeChoicePickerLabel(value: unknown): string {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

export function normalizeChoicePickerVariant(
  value: unknown,
): ChoicePickerVariant {
  return value === 'multipleSelection' || value === 'multiSelect'
    ? 'multipleSelection'
    : 'mutuallyExclusive';
}

export function normalizeChoicePickerDisplayStyle(
  value: unknown,
): ChoicePickerDisplayStyle {
  return value === 'chips' ? 'chips' : 'checkbox';
}

export function normalizeChoicePickerOptions(
  value: unknown,
): ChoicePickerOption[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: ChoicePickerOption[] = [];

  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const optionValue = record['value'];
    if (typeof optionValue !== 'string' || seen.has(optionValue)) continue;
    seen.add(optionValue);
    options.push({
      label: normalizeChoicePickerLabel(record['label']) || optionValue,
      value: optionValue,
    });
  }

  return options;
}

export function normalizeChoicePickerValue(
  value: unknown,
  options?: readonly ChoicePickerOption[],
): string[] {
  const allowed = options
    ? new Set(options.map((option) => option.value))
    : null;
  let rawValues: unknown[] = [];
  if (Array.isArray(value)) {
    rawValues = value;
  } else if (typeof value === 'string') {
    rawValues = [value];
  }
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const item of rawValues) {
    if (typeof item !== 'string') continue;
    if (allowed && !allowed.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    selected.push(item);
  }

  return selected;
}

export function toggleChoicePickerValue(
  currentValue: readonly string[],
  optionValue: string,
  variant: ChoicePickerVariant,
): string[] {
  if (variant === 'mutuallyExclusive') {
    return [optionValue];
  }

  return currentValue.includes(optionValue)
    ? currentValue.filter((value) => value !== optionValue)
    : [...currentValue, optionValue];
}

export function filterChoicePickerOptions(
  options: readonly ChoicePickerOption[],
  query: string,
): ChoicePickerOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...options];
  return options.filter((option) =>
    option.label.toLowerCase().includes(normalizedQuery)
    || option.value.toLowerCase().includes(normalizedQuery)
  );
}
