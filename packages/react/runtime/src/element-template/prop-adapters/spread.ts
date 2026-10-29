// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getEventValue } from './event-value.js';
import { isGestureSlotValue, prepareGestureForNative } from './gesture.js';
import { prepareSpreadRefAttrValue } from './ref.js';
import { isMainThreadFunction } from '../../core/main-thread-function.js';
import { isEventPropKey, isNamespacedEventPropKey, transformAttrName } from '../../shared/attribute-name.js';
import type { SerializableValue } from '../protocol/types.js';
import type { EtAttrAdapterContext } from '../runtime/template/attr-slot-plan.js';
import { prepareMTEventCtxForNative } from '../runtime/template/main-thread-event-ctx.js';
import { prepareMTRefForNative } from '../runtime/template/main-thread-ref-ctx.js';

const MAIN_THREAD_NAMESPACE_PREFIX = 'main-thread:';

// Keep per-key raw callback/ref provenance outside the wire value so in-place
// mutation of a caller-reused spread object cannot alias historical raw values.
const spreadRawSources = new WeakMap<Record<string, unknown>, Record<string, unknown>>();

export function isSpreadRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasOwnSpreadKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function isMainThreadEventPropKey(key: string): boolean {
  return key.startsWith(MAIN_THREAD_NAMESPACE_PREFIX)
    && isEventPropKey(key.slice(MAIN_THREAD_NAMESPACE_PREFIX.length));
}

function prepareSpreadAttrSlotImpl(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  allowMainThreadCapabilities: boolean,
  context?: EtAttrAdapterContext,
): SerializableValue | null {
  if (value === false || !isSpreadRecord(value)) {
    return null;
  }

  const prevPreparedSlot = context?.previousPreparedSlots?.[attrSlotIndex];
  const prevPreparedRecord = isSpreadRecord(prevPreparedSlot) ? prevPreparedSlot : undefined;
  const prevRawSources = prevPreparedRecord ? spreadRawSources.get(prevPreparedRecord) : undefined;

  const prepared: Record<string, SerializableValue> = {};
  let rawSources: Record<string, unknown> | undefined;

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

    if (allowMainThreadCapabilities) {
      if (key === 'main-thread:ref') {
        if (!hasOwnSpreadKey(value, key)) {
          continue;
        }
        const preparedRef = prepareMTRefForNative(
          spreadValue,
          prevPreparedRecord?.[key],
          prevRawSources?.[key],
        );
        prepared[key] = preparedRef;
        if (preparedRef !== null) {
          (rawSources ??= Object.create(null) as Record<string, unknown>)[key] = spreadValue;
        }
        continue;
      }

      if (key === 'main-thread:gesture') {
        if (!hasOwnSpreadKey(value, key)) {
          continue;
        }
        const prevGesture = prevPreparedRecord && hasOwnSpreadKey(prevPreparedRecord, key)
          ? prevPreparedRecord[key]
          : undefined;
        prepared[key] = prepareGestureForNative(
          spreadValue,
          isGestureSlotValue(prevGesture) ? prevGesture : undefined,
        ) as unknown as SerializableValue;
        continue;
      }

      if (isMainThreadEventPropKey(key)) {
        if (!hasOwnSpreadKey(value, key)) {
          continue;
        }
        if (spreadValue === null || spreadValue === undefined || spreadValue === false) {
          prepared[key] = null;
          continue;
        }
        if (!isMainThreadFunction(spreadValue)) {
          if (__DEV__) {
            lynx.reportError(
              new Error(
                `ElementTemplate main-thread event slot ${handleId}:${attrSlotIndex} (${key}) expects a worklet ctx object.`,
              ),
            );
          }
          prepared[key] = null;
          continue;
        }
        prepared[key] = prepareMTEventCtxForNative(
          spreadValue,
          prevPreparedRecord?.[key],
          prevRawSources?.[key],
        );
        (rawSources ??= Object.create(null) as Record<string, unknown>)[key] = spreadValue;
        continue;
      }
    }

    const transformedKey = transformAttrName(key);
    if (isEventPropKey(transformedKey)) {
      prepared[transformedKey] = spreadValue === null || spreadValue === undefined || spreadValue === false
        ? null
        : getEventValue(handleId, attrSlotIndex, key);
      continue;
    }

    if (
      spreadValue === undefined
      || transformedKey.endsWith(':ref')
      || transformedKey.endsWith(':gesture')
      || isNamespacedEventPropKey(key)
      || typeof spreadValue === 'function'
    ) {
      continue;
    }

    prepared[transformedKey] = spreadValue as SerializableValue;
  }

  if (rawSources) {
    spreadRawSources.set(prepared, rawSources);
  }

  return prepared;
}

export function prepareSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  context?: EtAttrAdapterContext,
): SerializableValue | null {
  return prepareSpreadAttrSlotImpl(handleId, attrSlotIndex, value, true, context);
}

export function prepareTypedSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  return prepareSpreadAttrSlotImpl(handleId, attrSlotIndex, value, false);
}
