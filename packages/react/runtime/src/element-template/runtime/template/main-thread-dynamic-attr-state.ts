// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { getMainThreadDynamicAttrSlotKinds } from './attr-slot-plan.js';
import { retainMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
import type { MTEventCtx, MTEventNativeWrapper } from './main-thread-event-ctx.js';
import { attachMTRefValue, cleanupMTRefValue, hydrateMTRefValue, retainMTRefValue } from './main-thread-ref-ctx.js';
import type { MTRefNativeWrapper, MTRefValue } from './main-thread-ref-ctx.js';
import type { SerializableValue } from '../../protocol/types.js';

type MainThreadDynamicAttrState =
  | { kind: 'mt-event'; nativeHeldValue: MTEventCtx }
  | { kind: 'mt-ref'; value: MTRefValue };

type MainThreadDynamicAttrStateMap<T> = Map<number, Map<number, T>>;

const mtEventAttrState: MainThreadDynamicAttrStateMap<MTEventCtx> = new Map();
const mtRefAttrState: MainThreadDynamicAttrStateMap<MTRefValue> = new Map();
const materializedMTRefHandleIds = new Set<number>();

export interface MainThreadDynamicAttrSubtreeHandle {
  uid: number;
  ref: ElementRef;
}

function deleteSlotState<T>(
  state: MainThreadDynamicAttrStateMap<T>,
  handleId: number,
  attrSlotIndex: number,
): void {
  const handleState = state.get(handleId);
  if (!handleState) {
    return;
  }
  handleState.delete(attrSlotIndex);
  if (handleState.size === 0) {
    state.delete(handleId);
  }
}

function cleanupMTRefHandleState(handleState: Map<number, MTRefValue>): void {
  for (const value of handleState.values()) {
    cleanupMTRefValue(value);
  }
}

function setSlotState<T>(
  state: MainThreadDynamicAttrStateMap<T>,
  handleId: number,
  attrSlotIndex: number,
  value: T,
): void {
  let handleState = state.get(handleId);
  if (!handleState) {
    handleState = new Map();
    state.set(handleId, handleState);
  }
  handleState.set(attrSlotIndex, value);
}

function setMTEventSlotState(handleId: number, attrSlotIndex: number, nativeHeldValue: MTEventCtx): void {
  retainMainThreadBackgroundFunctionCtx(nativeHeldValue);
  setSlotState(mtEventAttrState, handleId, attrSlotIndex, nativeHeldValue);
}

function setMTRefSlotState(
  handleId: number,
  attrSlotIndex: number,
  value: MTRefValue,
): void {
  retainMTRefValue(value);
  setSlotState(mtRefAttrState, handleId, attrSlotIndex, value);
}

export function prepareMainThreadDynamicAttrSlotsForNative(
  templateType: string,
  attributeSlots: readonly unknown[] | null | undefined,
): SerializableValue[] | null | undefined {
  if (attributeSlots == null) {
    return attributeSlots;
  }
  const slotKinds = getMainThreadDynamicAttrSlotKinds(templateType);
  if (!slotKinds) {
    return attributeSlots as SerializableValue[];
  }
  let nativeSlots: SerializableValue[] | undefined;
  for (const [attrSlotIndex, kind] of slotKinds) {
    if (kind !== 'mt-ref') {
      continue;
    }
    nativeSlots ??= attributeSlots.slice() as SerializableValue[];
    nativeSlots[attrSlotIndex] = null;
  }
  return nativeSlots ?? attributeSlots as SerializableValue[];
}

export function clearMainThreadDynamicAttrState(): void {
  for (const [handleId, handleState] of mtRefAttrState) {
    if (materializedMTRefHandleIds.has(handleId)) {
      cleanupMTRefHandleState(handleState);
    }
  }
  mtEventAttrState.clear();
  mtRefAttrState.clear();
  materializedMTRefHandleIds.clear();
}

export function getMainThreadDynamicAttrState(
  handleId: number,
  attrSlotIndex: number,
): MainThreadDynamicAttrState | undefined {
  const event = mtEventAttrState.get(handleId)?.get(attrSlotIndex);
  if (event) {
    return { kind: 'mt-event', nativeHeldValue: event };
  }
  const ref = mtRefAttrState.get(handleId)?.get(attrSlotIndex);
  return ref ? { kind: 'mt-ref', value: ref } : undefined;
}

export function initializeMainThreadDynamicAttrSlots(
  handleId: number,
  templateType: string,
  attributeSlots: readonly unknown[] | null | undefined,
): void {
  const slotKinds = getMainThreadDynamicAttrSlotKinds(templateType);
  if (!slotKinds) {
    return;
  }
  for (const [attrSlotIndex, kind] of slotKinds) {
    const value = attributeSlots?.[attrSlotIndex];
    if (kind === 'mt-event' && value != null) {
      setMTEventSlotState(handleId, attrSlotIndex, (value as MTEventNativeWrapper).value);
    } else if (kind === 'mt-ref' && value != null) {
      setMTRefSlotState(handleId, attrSlotIndex, (value as MTRefNativeWrapper).value);
    }
  }
}

export function updateMainThreadEventAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
): void {
  const previousState = isHydration
    ? mtEventAttrState.get(handleId)?.get(attrSlotIndex)
    : undefined;
  if (value == null) {
    deleteSlotState(mtEventAttrState, handleId, attrSlotIndex);
    return;
  }
  const nextValue = (value as MTEventNativeWrapper).value;
  setMTEventSlotState(handleId, attrSlotIndex, nextValue);
  if (previousState) {
    hydrateWorkletCtx(
      nextValue as Worklet,
      previousState as Worklet,
    );
  }
}

export function updateMainThreadRefAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  nativeRef: ElementRef,
  isHydration = false,
): void {
  const previousState = mtRefAttrState.get(handleId)?.get(attrSlotIndex);
  const isMaterialized = materializedMTRefHandleIds.has(handleId);
  if (value == null) {
    if (previousState && isMaterialized) {
      cleanupMTRefValue(previousState);
    }
    deleteSlotState(mtRefAttrState, handleId, attrSlotIndex);
    return;
  }
  if (previousState && isMaterialized) {
    cleanupMTRefValue(previousState);
  }
  const nextValue = (value as MTRefNativeWrapper).value;
  setMTRefSlotState(handleId, attrSlotIndex, nextValue);
  if (isHydration) {
    hydrateMTRefValue(nextValue, previousState);
  }
  if (isMaterialized) {
    attachMTRefValue(nextValue, nativeRef);
  }
}

export function attachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handle = handles[handleIndex]!;
    if (materializedMTRefHandleIds.has(handle.uid)) {
      continue;
    }
    materializedMTRefHandleIds.add(handle.uid);
    const handleState = mtRefAttrState.get(handle.uid);
    if (!handleState) {
      continue;
    }
    for (const value of handleState.values()) {
      attachMTRefValue(value, handle.ref);
    }
  }
}

export function detachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handleId = handles[handleIndex]!.uid;
    if (!materializedMTRefHandleIds.has(handleId)) {
      continue;
    }
    materializedMTRefHandleIds.delete(handleId);
    const handleState = mtRefAttrState.get(handleId);
    if (handleState) {
      cleanupMTRefHandleState(handleState);
    }
  }
}

export function deleteMainThreadDynamicAttrStateForSubtree(
  handleIds: readonly number[],
): void {
  for (const handleId of handleIds) {
    const handleState = mtRefAttrState.get(handleId);
    if (handleState && materializedMTRefHandleIds.has(handleId)) {
      cleanupMTRefHandleState(handleState);
    }
    materializedMTRefHandleIds.delete(handleId);
    mtEventAttrState.delete(handleId);
    mtRefAttrState.delete(handleId);
  }
}
