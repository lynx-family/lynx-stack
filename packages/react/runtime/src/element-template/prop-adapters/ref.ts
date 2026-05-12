// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SerializableValue } from '../protocol/types.js';

export function getRefValue(handleId: number, attrSlotIndex: number): string {
  return `${handleId}-${attrSlotIndex}`;
}

export function prepareRefAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'function' && (typeof value !== 'object' || !('current' in value))) {
    throw new Error(
      `Elements' "ref" property should be a function, or an object created `
        + `by createRef(), but got [${typeof value}] instead`,
    );
  }
  return getRefValue(handleId, attrSlotIndex);
}
