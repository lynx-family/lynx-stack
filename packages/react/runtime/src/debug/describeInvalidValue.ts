// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function describeInvalidValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'function') {
    return `function ${value.name || '(anonymous)'}`;
  }
  if (typeof value === 'string') {
    return `string "${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return `${typeof value} ${String(value)}`;
  }
  if (typeof value === 'symbol') {
    return `symbol ${String(value)}`;
  }
  return `unexpected ${typeof value}`;
}
