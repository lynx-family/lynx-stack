// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { getMainThreadDynamicAttrSlotKinds } from './attr-slot-plan.js';
import { prepareMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
import type { MTEventCtx, MTEventNativeWrapper } from './main-thread-event-ctx.js';
import { attachMTRefValue, cleanupMTRefValue, hydrateMTRefValue, retainMTRefValue } from './main-thread-ref-ctx.js';
import type { MTRefNativeWrapper, MTRefValue } from './main-thread-ref-ctx.js';
import type { SerializableValue } from '../../protocol/types.js';

type MainThreadDynamicAttrState =
  | { kind: 'mt-event'; nativeHeldValue: MTEventCtx }
  | { kind: 'mt-ref'; value: MTRefValue };

type MainThreadDynamicAttrStateMap<T> = Map<number, Map<number, T>>;

const mtEventAttrState: MainThreadDynamicAttrStateMap<MTEventCtx> = new Map();
interface MTRefSlotState {
  value: MTRefValue;
  attached: boolean;
  attaching?: boolean;
}

const mtRefAttrState: MainThreadDynamicAttrStateMap<MTRefSlotState> = new Map();
const attachedMTRefHandles = new Map<number, ElementTemplateHandle>();
const pendingMTRefHandles = new Set<number>();

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

function cleanupMTRefSlot(state: MTRefSlotState): void {
  if (state.attached) {
    state.attached = false;
    cleanupMTRefValue(state.value);
  }
}

function cleanupMTRefHandleState(handleState: Map<number, MTRefSlotState>): void {
  for (const state of handleState.values()) {
    cleanupMTRefSlot(state);
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
  const state: MTRefSlotState = { value, attached: false };
  setSlotState(mtRefAttrState, handleId, attrSlotIndex, state);
  if (attachedMTRefHandles.has(handleId)) pendingMTRefHandles.add(handleId);
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
    if (kind === 'mt-event' && attributeSlots[attrSlotIndex] != null) {
      prepareMainThreadBackgroundFunctionCtx((attributeSlots[attrSlotIndex] as MTEventNativeWrapper).value);
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
  const refs = [...mtRefAttrState.values()];
  mtEventAttrState.clear();
  mtRefAttrState.clear();
  attachedMTRefHandles.clear();
  pendingMTRefHandles.clear();
  for (const handleState of refs) cleanupMTRefHandleState(handleState);
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
  return ref ? { kind: 'mt-ref', value: ref.value } : undefined;
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
  nativeRef: ElementTemplateHandle,
  isHydration = false,
): void {
  const previousState = mtRefAttrState.get(handleId)?.get(attrSlotIndex);
  if (previousState) cleanupMTRefSlot(previousState);
  if (value == null) {
    deleteSlotState(mtRefAttrState, handleId, attrSlotIndex);
    return;
  }
  const nextValue = (value as MTRefNativeWrapper).value;
  if (isHydration) hydrateMTRefValue(nextValue, previousState?.value);
  if (attachedMTRefHandles.has(handleId)) attachedMTRefHandles.set(handleId, nativeRef);
  setMTRefSlotState(handleId, attrSlotIndex, nextValue);
}

export function attachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (const { uid, ref } of handles) {
    if (attachedMTRefHandles.has(uid)) continue;
    attachedMTRefHandles.set(uid, ref);
    if (mtRefAttrState.has(uid)) pendingMTRefHandles.add(uid);
  }
}

export function hasPendingMainThreadRefAttachments(): boolean {
  return pendingMTRefHandles.size > 0;
}

// Deliver after the logical batch is complete. Native materializes each queried
// instance on demand; no layout callback or cross-batch continuation is needed.
export function applyPendingMainThreadRefAttachments(): void {
  const pending = [...pendingMTRefHandles];
  pendingMTRefHandles.clear();
  for (const handleId of pending) {
    const nativeRef = attachedMTRefHandles.get(handleId);
    if (!nativeRef) continue;
    const slots = [...(mtRefAttrState.get(handleId) ?? [])];
    for (const [attrSlotIndex, state] of slots) {
      if (state.attached || state.attaching || !isCurrentMTRefSlot(handleId, attrSlotIndex, nativeRef, state)) continue;
      const element = __GetElementByAttrSlot(nativeRef, attrSlotIndex);
      if (!element) {
        throw new Error(
          `ElementTemplate main-thread:ref target ${handleId}:${attrSlotIndex} could not be materialized.`,
        );
      }
      attachMTRefSlot(handleId, attrSlotIndex, nativeRef, state, element);
    }
  }
}

function isCurrentMTRefSlot(
  handleId: number,
  attrSlotIndex: number,
  nativeRef: ElementTemplateHandle,
  state: MTRefSlotState,
): boolean {
  return attachedMTRefHandles.get(handleId) === nativeRef
    && mtRefAttrState.get(handleId)?.get(attrSlotIndex) === state;
}

function attachMTRefSlot(
  handleId: number,
  attrSlotIndex: number,
  nativeRef: ElementTemplateHandle,
  state: MTRefSlotState,
  element: ElementRef,
): void {
  state.attaching = true;
  try {
    attachMTRefValue(state.value, element);
  } finally {
    state.attaching = false;
  }
  if (isCurrentMTRefSlot(handleId, attrSlotIndex, nativeRef, state)) {
    state.attached = true;
  } else {
    // A callback may synchronously remove its own binding before returning cleanup.
    cleanupMTRefValue(state.value);
  }
}

export function detachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (const { uid } of handles) {
    attachedMTRefHandles.delete(uid);
    pendingMTRefHandles.delete(uid);
    const handleState = mtRefAttrState.get(uid);
    if (handleState) {
      for (const [attrSlotIndex, state] of handleState) {
        cleanupMTRefSlot(state);
        // A callback may detach and reattach while this batch is delivering refs.
        handleState.set(attrSlotIndex, { value: state.value, attached: false });
      }
    }
  }
}

export function deleteMainThreadDynamicAttrStateForSubtree(
  handleIds: readonly number[],
): void {
  for (const handleId of handleIds) {
    const handleState = mtRefAttrState.get(handleId);
    mtRefAttrState.delete(handleId);
    attachedMTRefHandles.delete(handleId);
    pendingMTRefHandles.delete(handleId);
    mtEventAttrState.delete(handleId);
    if (handleState) cleanupMTRefHandleState(handleState);
  }
}
