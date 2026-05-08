// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { deleteEventHandler, setEventHandler } from '../prop-adapters/event.js';
import type { EtEventHandler } from '../prop-adapters/event.js';
import type { SerializableValue } from '../protocol/types.js';
import { __etAttrPlanMap, adaptEventAttrSlot } from '../runtime/template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../runtime/template/attr-slot-plan.js';

function normalizeAttributeSlots(rawSlots: readonly unknown[]): SerializableValue[] {
  let normalizedSlots: SerializableValue[] | undefined;
  for (let slotIndex = 0; slotIndex < rawSlots.length; slotIndex += 1) {
    const rawSlot = rawSlots[slotIndex];
    if (rawSlot !== undefined) {
      continue;
    }
    normalizedSlots ??= rawSlots.slice() as SerializableValue[];
    normalizedSlots[slotIndex] = null;
  }
  return normalizedSlots ?? rawSlots as SerializableValue[];
}

export function prepareAttributeSlots(
  templateKey: string,
  handleId: number,
  rawSlots: readonly unknown[],
  registerEvents: boolean,
): SerializableValue[] {
  const attrPlan = __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return normalizeAttributeSlots(rawSlots);
  }

  const preparedSlots = normalizeAttributeSlots(rawSlots).slice();
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
    const rawValue = rawSlots[attrSlotIndex];
    preparedSlots[attrSlotIndex] = adapter(handleId, attrSlotIndex, rawValue);

    if (registerEvents && adapter === adaptEventAttrSlot) {
      if (typeof rawValue === 'function') {
        setEventHandler(handleId, attrSlotIndex, rawValue as EtEventHandler);
      } else {
        deleteEventHandler(handleId, attrSlotIndex);
      }
    }
  }

  return preparedSlots;
}

export function clearAttributeSlotEventHandlers(templateKey: string, handleId: number): void {
  const attrPlan = __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return;
  }

  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
    if (adapter === adaptEventAttrSlot) {
      deleteEventHandler(handleId, attrSlotIndex);
    }
  }
}
