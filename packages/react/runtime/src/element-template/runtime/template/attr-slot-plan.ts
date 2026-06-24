// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMTEventCtx, prepareMTEventCtxForNative } from './main-thread-event-ctx.js';
import { getEventValue } from '../../prop-adapters/event-value.js';
import { prepareRefAttrSlot } from '../../prop-adapters/ref.js';
import { prepareSpreadAttrSlot } from '../../prop-adapters/spread.js';
import type { SerializableValue } from '../../protocol/types.js';

export interface EtAttrAdapterContext {
  previousPreparedSlots: readonly unknown[];
  previousRawSlots: readonly unknown[];
}

export type EtAttrAdapter = (
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  context?: EtAttrAdapterContext,
) => SerializableValue | null;

export type EtAttrPlan = (number | EtAttrAdapter)[];

export type EtAttrPlanMap = Record<
  string,
  EtAttrPlan | undefined
>;

export const __etAttrPlanMap = Object.create(null) as EtAttrPlanMap;

export function adaptEventAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  if (value === null || value === undefined || value === false) {
    return null;
  }
  return getEventValue(handleId, attrSlotIndex);
}

export function adaptMTEventAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  context?: EtAttrAdapterContext,
): SerializableValue | null {
  if (value === null || value === undefined || value === false) {
    return null;
  }
  if (!isMTEventCtx(value)) {
    if (__DEV__) {
      lynx.reportError(
        new Error(`ElementTemplate main-thread event slot ${handleId}:${attrSlotIndex} expects a worklet ctx object.`),
      );
    }
    return null;
  }
  return prepareMTEventCtxForNative(
    value,
    context?.previousPreparedSlots?.[attrSlotIndex],
    context?.previousRawSlots?.[attrSlotIndex],
  );
}

export function adaptRefAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  return prepareRefAttrSlot(handleId, attrSlotIndex, value);
}

export function adaptSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  return prepareSpreadAttrSlot(handleId, attrSlotIndex, value);
}

export function clearEtAttrPlanMap(): void {
  // The compiled output assigns into the exported side table directly, so the
  // object identity must stay stable when tests or teardown clear state.
  for (const templateKey in __etAttrPlanMap) {
    delete __etAttrPlanMap[templateKey];
  }
}
