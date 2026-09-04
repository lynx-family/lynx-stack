// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getRefFromValue, getSpreadRefFromValue, queueRefAttrUpdate } from '../prop-adapters/ref.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateOp } from '../protocol/opcodes.js';
import type { SerializableValue } from '../protocol/types.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  getMainThreadDynamicAttrSlotKinds,
} from '../runtime/template/attr-slot-plan.js';
import type { EtAttrAdapter, EtAttrAdapterContext, EtAttrPlan } from '../runtime/template/attr-slot-plan.js';

export interface PrepareAttributeSlotsOptions {
  previousPreparedSlots?: readonly unknown[];
  previousRawSlots?: readonly unknown[];
  attributePlan?: EtAttrPlan | undefined;
}

type RefAttrPlan = (number | typeof getSpreadRefFromValue)[];

const refAttrPlans = new WeakMap<EtAttrPlan, RefAttrPlan>();

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
  refAttrPlan: RefAttrPlan,
  previousRawSlots?: readonly unknown[],
  nextRawSlots?: readonly unknown[],
): void {
  for (let planIndex = 0; planIndex < refAttrPlan.length; planIndex += 2) {
    const attrSlotIndex = refAttrPlan[planIndex] as number;
    const readRef = refAttrPlan[planIndex + 1] as typeof getSpreadRefFromValue;
    queueRefAttrUpdate(
      readRef(previousRawSlots?.[attrSlotIndex]) ?? null,
      readRef(nextRawSlots?.[attrSlotIndex]) ?? null,
      handleId,
      attrSlotIndex,
    );
  }
}

export function prepareAttributeSlots(
  templateKey: string,
  handleId: number,
  rawSlots: readonly unknown[],
  options?: PrepareAttributeSlotsOptions,
): SerializableValue[] {
  const attrPlan = options?.attributePlan ?? __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return normalizeAttributeSlots(rawSlots);
  }

  const normalizedSlots = normalizeAttributeSlots(rawSlots);
  const preparedSlots = normalizedSlots === rawSlots
    ? rawSlots.slice() as SerializableValue[]
    : normalizedSlots;
  const previousPreparedSlots = options?.previousPreparedSlots;
  const previousRawSlots = options?.previousRawSlots;
  const adapterContext: EtAttrAdapterContext | undefined = previousPreparedSlots && previousRawSlots
    ? {
      previousPreparedSlots,
      previousRawSlots,
    }
    : undefined;
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    const attrSlotIndex = attrPlan[planIndex] as number;
    const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
    const rawValue = rawSlots[attrSlotIndex];
    preparedSlots[attrSlotIndex] = adapter(handleId, attrSlotIndex, rawValue, adapterContext);
  }

  return preparedSlots;
}

export function queueRefAttributeSlotUpdates(
  templateKey: string,
  handleId: number,
  previousRawSlots?: readonly unknown[],
  nextRawSlots?: readonly unknown[],
  attributePlan?: EtAttrPlan,
): void {
  const attrPlan = attributePlan ?? __etAttrPlanMap[templateKey];
  if (!attrPlan || attrPlan.length === 0) {
    return;
  }

  let refAttrPlan = refAttrPlans.get(attrPlan);
  if (!refAttrPlan) {
    refAttrPlan = [];
    for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
      const adapter = attrPlan[planIndex + 1];
      if (adapter === adaptRefAttrSlot || adapter === adaptSpreadAttrSlot) {
        refAttrPlan.push(
          attrPlan[planIndex] as number,
          adapter === adaptRefAttrSlot ? getRefFromValue : getSpreadRefFromValue,
        );
      }
    }
    // Compiled plans are static. Keying by their identity also keeps replacement
    // and registry teardown from retaining a stale plan for a template name.
    refAttrPlans.set(attrPlan, refAttrPlan);
  }

  queuePlannedRefAttributeSlotUpdates(handleId, refAttrPlan, previousRawSlots, nextRawSlots);
}

export function getAttributeSlotUpdateOp(
  templateType: string,
  attrSlotIndex: number,
): ElementTemplateUpdateOp {
  const kind = getMainThreadDynamicAttrSlotKinds(templateType)?.get(attrSlotIndex);
  if (kind === 'mt-event') {
    return ElementTemplateUpdateOps.setMainThreadEvent;
  }
  if (kind === 'mt-ref') {
    return ElementTemplateUpdateOps.setMainThreadRef;
  }
  return ElementTemplateUpdateOps.setAttribute;
}
