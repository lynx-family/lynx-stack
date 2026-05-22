// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getEventValue } from './event-value.js';
import { prepareSpreadRefAttrValue } from './ref.js';
import type { SerializableValue } from '../protocol/types.js';

export interface SpreadAttrAdapterContext {
  previousPreparedValue?: unknown;
}

const eventPropKeyRegExp = /^(?:global-bind|bind|catch|capture-bind|capture-catch)[A-Za-z]+$/;
const namespacedEventKeyRegExp = /^[A-Za-z-]+:(?:global-bind|bind|catch|capture-bind|capture-catch)[A-Za-z]+$/;

function isEventPropKey(key: string): boolean {
  return eventPropKeyRegExp.test(key);
}

function isSpreadRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function prepareSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  _context?: SpreadAttrAdapterContext,
): SerializableValue | null {
  if (value === false || !isSpreadRecord(value)) {
    return null;
  }

  const prepared: Record<string, SerializableValue> = {};

  for (const key in value) {
    const spreadValue = value[key];
    if (key === '__spread' || key === '__self' || key === '__source') {
      continue;
    }

    if (key === 'class' || key === 'className') {
      prepared['class'] = (spreadValue ?? '') as SerializableValue;
      continue;
    }

    if (key === 'ref') {
      const refValue = prepareSpreadRefAttrValue(handleId, attrSlotIndex, value);
      if (refValue !== undefined) {
        prepared['ref'] = refValue;
      }
      continue;
    }

    if (isEventPropKey(key)) {
      prepared[key] = spreadValue === null || spreadValue === undefined || spreadValue === false
        ? null
        : getEventValue(handleId, attrSlotIndex, key);
      continue;
    }

    if (
      spreadValue === undefined
      || key.endsWith(':ref')
      || key.endsWith(':gesture')
      || namespacedEventKeyRegExp.test(key)
      || typeof spreadValue === 'function'
    ) {
      continue;
    }

    prepared[key] = spreadValue as SerializableValue;
  }

  return prepared;
}
