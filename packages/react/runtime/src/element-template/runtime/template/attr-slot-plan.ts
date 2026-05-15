// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getEventValue } from '../../prop-adapters/event-value.js';
import { prepareSpreadAttrSlot } from '../../prop-adapters/spread.js';
import type { SpreadAttrAdapterContext } from '../../prop-adapters/spread.js';
import type { SerializableValue } from '../../protocol/types.js';

export interface EtAttrAdapterContext extends SpreadAttrAdapterContext {}

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
  _context?: EtAttrAdapterContext,
): SerializableValue | null {
  if (value === null || value === undefined || value === false) {
    return null;
  }
  return getEventValue(handleId, attrSlotIndex);
}

export function adaptSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  context?: EtAttrAdapterContext,
): SerializableValue | null {
  return prepareSpreadAttrSlot(handleId, attrSlotIndex, value, context);
}

export function clearEtAttrPlanMap(): void {
  // The compiled output assigns into the exported side table directly, so the
  // object identity must stay stable when tests or teardown clear state.
  for (const templateKey in __etAttrPlanMap) {
    delete __etAttrPlanMap[templateKey];
  }
}
