// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __etAttrPlanMap, adaptMTEventAttrSlot } from './attr-slot-plan.js';
import { retainMTEventBackgroundFunctionCtx } from './main-thread-background-function.js';
import { isMTEventNativeWrapper } from './main-thread-event-ctx.js';
import type { MTEventCtx } from './main-thread-event-ctx.js';

export interface MainThreadDynamicAttrState {
  kind: 'mt-event';
  nativeHeldValue: MTEventCtx;
}

export interface MainThreadDynamicAttrHydrateHandoff {
  kind: 'mt-event';
  nextValue: MTEventCtx;
  previousNativeHeldValue: MTEventCtx;
}

const dynamicAttrState = new Map<number, Map<number, MainThreadDynamicAttrState>>();
const mtEventSlotsByHandle = new Map<number, Set<number>>();

function deleteSlotState(handleId: number, attrSlotIndex: number): void {
  const handleState = dynamicAttrState.get(handleId);
  if (!handleState) {
    return;
  }
  handleState.delete(attrSlotIndex);
  if (handleState.size === 0) {
    dynamicAttrState.delete(handleId);
  }
}

function setSlotState(handleId: number, attrSlotIndex: number, nativeHeldValue: MTEventCtx): void {
  retainMTEventBackgroundFunctionCtx(nativeHeldValue);
  let handleState = dynamicAttrState.get(handleId);
  if (!handleState) {
    handleState = new Map();
    dynamicAttrState.set(handleId, handleState);
  }
  handleState.set(attrSlotIndex, {
    kind: 'mt-event',
    nativeHeldValue,
  });
}

function getMTEventAttrSlotIndexes(templateType: string): Set<number> | undefined {
  const attrPlan = __etAttrPlanMap[templateType];
  if (!attrPlan) {
    return undefined;
  }
  let slots: Set<number> | undefined;
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    if (attrPlan[planIndex + 1] !== adaptMTEventAttrSlot) {
      continue;
    }
    slots ??= new Set();
    slots.add(attrPlan[planIndex] as number);
  }
  return slots;
}

export function clearMainThreadDynamicAttrState(): void {
  dynamicAttrState.clear();
  mtEventSlotsByHandle.clear();
}

export function getMainThreadDynamicAttrState(
  handleId: number,
  attrSlotIndex: number,
): MainThreadDynamicAttrState | undefined {
  return dynamicAttrState.get(handleId)?.get(attrSlotIndex);
}

export function initializeMainThreadDynamicAttrSlots(
  handleId: number,
  templateType: string,
  attributeSlots: readonly unknown[] | null | undefined,
): void {
  const mtEventSlots = getMTEventAttrSlotIndexes(templateType);
  if (!mtEventSlots) {
    return;
  }
  mtEventSlotsByHandle.set(handleId, mtEventSlots);
  for (const attrSlotIndex of mtEventSlots) {
    const value = attributeSlots?.[attrSlotIndex];
    if (isMTEventNativeWrapper(value)) {
      setSlotState(handleId, attrSlotIndex, value.value);
    }
  }
}

export function updateMainThreadDynamicAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
): MainThreadDynamicAttrHydrateHandoff | undefined {
  if (mtEventSlotsByHandle.get(handleId)?.has(attrSlotIndex) !== true) {
    return undefined;
  }
  const previousState = dynamicAttrState.get(handleId)?.get(attrSlotIndex);
  if (!isMTEventNativeWrapper(value)) {
    deleteSlotState(handleId, attrSlotIndex);
    return undefined;
  }
  setSlotState(handleId, attrSlotIndex, value.value);
  if (isHydration && previousState) {
    return {
      kind: 'mt-event',
      nextValue: value.value,
      previousNativeHeldValue: previousState.nativeHeldValue,
    };
  }
  return undefined;
}

export function deleteMainThreadDynamicAttrStateForSubtree(
  handleIds: readonly number[],
): void {
  for (const handleId of handleIds) {
    mtEventSlotsByHandle.delete(handleId);
    dynamicAttrState.delete(handleId);
  }
}
