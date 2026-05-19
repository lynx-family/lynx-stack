// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getSpreadRefFromValue, queueRefAttrUpdate } from '../prop-adapters/ref.js';
import type { SerializableValue } from '../protocol/types.js';
import { __etAttrPlanMap, adaptRefAttrSlot, adaptSpreadAttrSlot } from '../runtime/template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../runtime/template/attr-slot-plan.js';

export interface PrepareAttributeSlotsOptions {
  previousRawSlots?: readonly unknown[];
  queueRefEffects?: boolean;
}

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

function queuePlannedRefAttributeSlotUpdates(
  handleId: number,
  attrPlan: readonly (number | EtAttrAdapter)[],
  previousRawSlots?: readonly unknown[],
  nextRawSlots?: readonly unknown[],
): void {
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;

    if (adapter === adaptRefAttrSlot) {
      queueRefAttrUpdate(
        previousRawSlots?.[attrSlotIndex],
        nextRawSlots?.[attrSlotIndex],
        handleId,
        attrSlotIndex,
      );
      continue;
    }

    if (adapter === adaptSpreadAttrSlot) {
      const previousSpreadRef = getSpreadRefFromValue(previousRawSlots?.[attrSlotIndex]);
      const nextSpreadRef = getSpreadRefFromValue(nextRawSlots?.[attrSlotIndex]);
      if (previousSpreadRef === undefined && nextSpreadRef === undefined) {
        continue;
      }
      queueRefAttrUpdate(
        previousSpreadRef,
        nextSpreadRef ?? null,
        handleId,
        attrSlotIndex,
      );
    }
  }
}

export function prepareAttributeSlots(
  templateKey: string,
  handleId: number,
  rawSlots: readonly unknown[],
  options?: PrepareAttributeSlotsOptions,
): SerializableValue[] {
  const attrPlan = __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return normalizeAttributeSlots(rawSlots);
  }

  const normalizedSlots = normalizeAttributeSlots(rawSlots);
  const preparedSlots = normalizedSlots === rawSlots
    ? rawSlots.slice() as SerializableValue[]
    : normalizedSlots;
  const shouldQueueRefEffects = options?.queueRefEffects === true;
  const previousRawSlots = options?.previousRawSlots;
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
    const rawValue = rawSlots[attrSlotIndex];
    preparedSlots[attrSlotIndex] = adapter(handleId, attrSlotIndex, rawValue);
  }
  if (shouldQueueRefEffects) {
    // Ref effects compare raw user refs, not prepared marker strings or the
    // spread wrapper object.
    queuePlannedRefAttributeSlotUpdates(handleId, attrPlan, previousRawSlots, rawSlots);
  }

  return preparedSlots;
}

export function queueRefAttributeSlotUpdates(
  templateKey: string,
  handleId: number,
  previousRawSlots?: readonly unknown[],
  nextRawSlots?: readonly unknown[],
): void {
  const attrPlan = __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return;
  }

  queuePlannedRefAttributeSlotUpdates(handleId, attrPlan, previousRawSlots, nextRawSlots);
}
