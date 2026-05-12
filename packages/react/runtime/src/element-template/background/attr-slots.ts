// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SerializableValue } from '../protocol/types.js';
import { __etAttrPlanMap } from '../runtime/template/attr-slot-plan.js';
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
): SerializableValue[] {
  const attrPlan = __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return normalizeAttributeSlots(rawSlots);
  }

  const normalizedSlots = normalizeAttributeSlots(rawSlots);
  const preparedSlots = normalizedSlots === rawSlots
    ? rawSlots.slice() as SerializableValue[]
    : normalizedSlots;
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
    const rawValue = rawSlots[attrSlotIndex];
    preparedSlots[attrSlotIndex] = adapter(handleId, attrSlotIndex, rawValue);
  }

  return preparedSlots;
}
