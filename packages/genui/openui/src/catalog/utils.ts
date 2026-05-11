// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const GAP_CLASS: Record<string, string> = {
  none: 'OpenUIGapNone',
  xs: 'OpenUIGapXs',
  s: 'OpenUIGapS',
  m: 'OpenUIGapM',
  l: 'OpenUIGapL',
  xl: 'OpenUIGapXl',
};

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
