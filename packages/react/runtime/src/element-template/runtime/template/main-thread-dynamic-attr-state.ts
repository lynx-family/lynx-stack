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
import { hydrateGestureCallbacks, retainGestureCallbacks } from '../../prop-adapters/gesture.js';
import type { GestureSlotValue } from '../../prop-adapters/gesture.js';
import type { SerializableValue } from '../../protocol/types.js';

type MainThreadDynamicAttrState =
  | { kind: 'mt-event'; nativeHeldValue: MTEventCtx }
  | { kind: 'mt-ref'; value: MTRefValue };

type MainThreadDynamicAttrStateMap<T> = Map<number, Map<number, T>>;

const gestureAttrState: MainThreadDynamicAttrStateMap<GestureSlotValue> = new Map();

const mtEventAttrState: MainThreadDynamicAttrStateMap<MTEventCtx> = new Map();
const mtRefAttrState: MainThreadDynamicAttrStateMap<MTRefValue> = new Map();
const attachedMTRefHandleIds = new Set<number>();

interface PendingMTRefAttachment {
  handleId: number;
  attrSlotIndex: number;
  value: MTRefValue;
  nativeRef: ElementTemplateHandle;
}

let pendingMTRefAttachments: PendingMTRefAttachment[] = [];

export interface MainThreadDynamicAttrSubtreeHandle {
  uid: number;
  ref: ElementTemplateHandle;
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
    if (kind === 'gesture' && attributeSlots[attrSlotIndex] != null) {
      retainGestureCallbacks(attributeSlots[attrSlotIndex] as GestureSlotValue);
    }
    if (kind === 'mt-event' && attributeSlots[attrSlotIndex] != null) {
      retainMainThreadBackgroundFunctionCtx((attributeSlots[attrSlotIndex] as MTEventNativeWrapper).value);
    }
    if (kind !== 'mt-ref') {
      continue;
    }
    nativeSlots ??= attributeSlots.slice() as SerializableValue[];
    nativeSlots[attrSlotIndex] = null;
  }
  return nativeSlots ?? attributeSlots as SerializableValue[];
}

export function clearMainThreadDynamicAttrState(): void {
  try {
    for (const [handleId, handleState] of mtRefAttrState) {
      if (attachedMTRefHandleIds.has(handleId)) {
        cleanupMTRefHandleState(handleState);
      }
    }
  } finally {
    gestureAttrState.clear();
    mtEventAttrState.clear();
    mtRefAttrState.clear();
    attachedMTRefHandleIds.clear();
    pendingMTRefAttachments = [];
  }
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
    if (kind === 'gesture' && value != null) {
      updateGestureAttrSlot(handleId, attrSlotIndex, value);
    } else if (kind === 'mt-event' && value != null) {
      setMTEventSlotState(handleId, attrSlotIndex, (value as MTEventNativeWrapper).value);
    } else if (kind === 'mt-ref' && value != null) {
      setMTRefSlotState(handleId, attrSlotIndex, (value as MTRefNativeWrapper).value);
    }
  }
}

export function updateGestureAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration = false,
): void {
  const previous = isHydration ? gestureAttrState.get(handleId)?.get(attrSlotIndex) : undefined;
  if (value == null) {
    deleteSlotState(gestureAttrState, handleId, attrSlotIndex);
    return;
  }
  const next = value as GestureSlotValue;
  if (previous) {
    hydrateGestureCallbacks(next, previous);
  }
  setSlotState(gestureAttrState, handleId, attrSlotIndex, next);
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
  nativeRef: ElementTemplateHandle,
  isHydration = false,
): void {
  const previousState = mtRefAttrState.get(handleId)?.get(attrSlotIndex);
  const isAttached = attachedMTRefHandleIds.has(handleId);
  if (value == null) {
    if (previousState && isAttached) {
      cleanupMTRefValue(previousState);
    }
    deleteSlotState(mtRefAttrState, handleId, attrSlotIndex);
    return;
  }
  if (previousState && isAttached) {
    cleanupMTRefValue(previousState);
  }
  const nextValue = (value as MTRefNativeWrapper).value;
  setMTRefSlotState(handleId, attrSlotIndex, nextValue);
  if (isHydration) {
    hydrateMTRefValue(nextValue, previousState);
  }
  if (isAttached) {
    pendingMTRefAttachments.push({ handleId, attrSlotIndex, value: nextValue, nativeRef });
  }
}

export function attachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handle = handles[handleIndex]!;
    if (attachedMTRefHandleIds.has(handle.uid)) {
      continue;
    }
    attachedMTRefHandleIds.add(handle.uid);
    const handleState = mtRefAttrState.get(handle.uid);
    if (!handleState) {
      continue;
    }
    for (const [attrSlotIndex, value] of handleState) {
      pendingMTRefAttachments.push({ handleId: handle.uid, attrSlotIndex, value, nativeRef: handle.ref });
    }
  }
}

// Consume one queue snapshot, matching Snapshot's ref delivery boundary.
export function applyPendingMainThreadRefAttachments(): void {
  const pending = pendingMTRefAttachments;
  pendingMTRefAttachments = [];
  for (const { handleId, attrSlotIndex, value, nativeRef } of pending) {
    const element = __GetElementByAttrSlot(nativeRef, attrSlotIndex);
    if (!element) {
      throw new Error(
        `ElementTemplate main-thread:ref target ${handleId}:${attrSlotIndex} could not be materialized.`,
      );
    }
    attachMTRefValue(value, element);
  }
}

export function detachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handleId = handles[handleIndex]!.uid;
    if (!attachedMTRefHandleIds.has(handleId)) {
      continue;
    }
    attachedMTRefHandleIds.delete(handleId);
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
    if (handleState && attachedMTRefHandleIds.has(handleId)) {
      cleanupMTRefHandleState(handleState);
    }
    attachedMTRefHandleIds.delete(handleId);
    gestureAttrState.delete(handleId);
    mtEventAttrState.delete(handleId);
    mtRefAttrState.delete(handleId);
  }
}
