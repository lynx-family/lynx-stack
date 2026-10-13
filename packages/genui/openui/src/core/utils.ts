// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** Keep element identity independent of editable content and sibling position. */
export function keyFrom(value: unknown, fallbackIndex = 0): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const node = value as Record<string, unknown>;
    if (node['type'] === 'element') {
      if (typeof node['statementId'] === 'string') return node['statementId'];
      const props = node['props'] as Record<string, unknown> | undefined;
      const identity = props?.['id'] ?? props?.['name'];
      const type = typeof node['typeName'] === 'string'
        ? node['typeName']
        : 'element';
      if (typeof identity === 'string' && identity) {
        return `${type}:${identity}`;
      }
      return `${type}:${fallbackIndex}`;
    }
  }
  return `${typeof value}:${fallbackIndex}`;
}
