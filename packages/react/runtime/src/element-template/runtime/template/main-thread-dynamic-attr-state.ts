// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getMainThreadDynamicAttrSlotKinds } from './attr-slot-plan.js';
import type { MainThreadDynamicAttrKind } from './attr-slot-plan.js';
import { retainMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
import { isMTEventNativeWrapper } from './main-thread-event-ctx.js';
import type { MTEventCtx } from './main-thread-event-ctx.js';
import { attachMTRefValue, cleanupMTRefValue, hydrateMTRefValue, retainMTRefValue } from './main-thread-ref-ctx.js';
import type { MTRefNativeWrapper, MTRefValue } from './main-thread-ref-ctx.js';
import type { SerializableValue } from '../../protocol/types.js';

export interface MainThreadDynamicMTEventAttrState {
  kind: 'mt-event';
  nativeHeldValue: MTEventCtx;
}

export interface MainThreadDynamicMTRefAttrState {
  kind: 'mt-ref';
  value: MTRefValue;
  attached: boolean;
}

export type MainThreadDynamicAttrState =
  | MainThreadDynamicMTEventAttrState
  | MainThreadDynamicMTRefAttrState;

export interface MainThreadDynamicAttrHydrateHandoff {
  kind: 'mt-event';
  nextValue: MTEventCtx;
  previousNativeHeldValue: MTEventCtx;
}

const dynamicAttrState = new Map<number, Map<number, MainThreadDynamicAttrState>>();
const dynamicAttrKindsByHandle = new Map<number, ReadonlyMap<number, MainThreadDynamicAttrKind>>();
const blockedMTRefAttachmentHandleIds = new Set<number>();

export interface MainThreadDynamicAttrSubtreeHandle {
  uid: number;
  ref: ElementRef;
}

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

function cleanupDynamicAttrState(state: MainThreadDynamicAttrState | undefined): void {
  if (state?.kind === 'mt-ref' && state.attached) {
    cleanupMTRefValue(state.value);
    state.attached = false;
  }
}

function cleanupHandleState(handleState: Map<number, MainThreadDynamicAttrState>): void {
  for (const state of handleState.values()) {
    cleanupDynamicAttrState(state);
  }
}

function setDynamicAttrState(
  handleId: number,
  attrSlotIndex: number,
  state: MainThreadDynamicAttrState,
): void {
  let handleState = dynamicAttrState.get(handleId);
  if (!handleState) {
    handleState = new Map();
    dynamicAttrState.set(handleId, handleState);
  }
  handleState.set(attrSlotIndex, state);
}

function setMTEventSlotState(handleId: number, attrSlotIndex: number, nativeHeldValue: MTEventCtx): void {
  retainMainThreadBackgroundFunctionCtx(nativeHeldValue);
  setDynamicAttrState(handleId, attrSlotIndex, {
    kind: 'mt-event',
    nativeHeldValue,
  });
}

function setMTRefSlotState(
  handleId: number,
  attrSlotIndex: number,
  value: MTRefValue,
): MainThreadDynamicMTRefAttrState {
  retainMTRefValue(value);
  const state: MainThreadDynamicMTRefAttrState = {
    kind: 'mt-ref',
    value,
    attached: false,
  };
  setDynamicAttrState(handleId, attrSlotIndex, state);
  return state;
}

function attachMTRefSlotState(
  state: MainThreadDynamicMTRefAttrState,
  nativeRef: ElementRef,
): void {
  if (state.attached) {
    return;
  }
  attachMTRefValue(state.value, nativeRef);
  state.attached = true;
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

export function prepareMainThreadDynamicAttrValueForNative(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  if (dynamicAttrKindsByHandle.get(handleId)?.get(attrSlotIndex) === 'mt-ref') {
    return null;
  }
  return value as SerializableValue | null;
}

export function clearMainThreadDynamicAttrState(): void {
  for (const handleState of dynamicAttrState.values()) {
    cleanupHandleState(handleState);
  }
  dynamicAttrState.clear();
  dynamicAttrKindsByHandle.clear();
  blockedMTRefAttachmentHandleIds.clear();
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
  nativeRef: ElementRef,
  attachMTRefs: boolean,
): void {
  const slotKinds = getMainThreadDynamicAttrSlotKinds(templateType);
  if (!slotKinds) {
    return;
  }
  dynamicAttrKindsByHandle.set(handleId, slotKinds);
  let hasMTRefSlot = false;
  for (const [attrSlotIndex, kind] of slotKinds) {
    const value = attributeSlots?.[attrSlotIndex];
    if (kind === 'mt-event' && isMTEventNativeWrapper(value)) {
      setMTEventSlotState(handleId, attrSlotIndex, value.value);
    } else if (kind === 'mt-ref') {
      hasMTRefSlot = true;
      if (value != null) {
        const state = setMTRefSlotState(handleId, attrSlotIndex, (value as MTRefNativeWrapper).value);
        if (attachMTRefs) {
          attachMTRefSlotState(state, nativeRef);
        }
      }
    }
  }
  if (hasMTRefSlot) {
    if (attachMTRefs) {
      blockedMTRefAttachmentHandleIds.delete(handleId);
    } else {
      blockedMTRefAttachmentHandleIds.add(handleId);
    }
  }
}

export function updateMainThreadDynamicAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  nativeRef: ElementRef,
  isHydration = false,
): MainThreadDynamicAttrHydrateHandoff | undefined {
  const kind = dynamicAttrKindsByHandle.get(handleId)?.get(attrSlotIndex);
  if (!kind) {
    return undefined;
  }
  if (kind === 'mt-event') {
    const previousState = isHydration
      ? dynamicAttrState.get(handleId)?.get(attrSlotIndex)
      : undefined;
    if (!isMTEventNativeWrapper(value)) {
      deleteSlotState(handleId, attrSlotIndex);
      return undefined;
    }
    setMTEventSlotState(handleId, attrSlotIndex, value.value);
    if (isHydration && previousState?.kind === 'mt-event') {
      return {
        kind: 'mt-event',
        nextValue: value.value,
        previousNativeHeldValue: previousState.nativeHeldValue,
      };
    }
    return undefined;
  }

  const previousState = dynamicAttrState.get(handleId)?.get(attrSlotIndex) as
    | MainThreadDynamicMTRefAttrState
    | undefined;
  if (value == null) {
    cleanupDynamicAttrState(previousState);
    deleteSlotState(handleId, attrSlotIndex);
    return undefined;
  }
  const previousValue = previousState?.value;
  if (previousState) {
    cleanupDynamicAttrState(previousState);
  }
  const state = setMTRefSlotState(handleId, attrSlotIndex, (value as MTRefNativeWrapper).value);
  if (isHydration) {
    hydrateMTRefValue(state.value, previousValue);
  }
  if (!blockedMTRefAttachmentHandleIds.has(handleId)) {
    attachMTRefSlotState(state, nativeRef);
  }
  return undefined;
}

export function attachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handle = handles[handleIndex]!;
    blockedMTRefAttachmentHandleIds.delete(handle.uid);
    const handleState = dynamicAttrState.get(handle.uid);
    if (!handleState) {
      continue;
    }
    for (const state of handleState.values()) {
      if (state.kind === 'mt-ref') {
        attachMTRefSlotState(state, handle.ref);
      }
    }
  }
}

export function detachMainThreadDynamicAttrRefsForSubtree(
  handles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handleId = handles[handleIndex]!.uid;
    blockedMTRefAttachmentHandleIds.add(handleId);
    const handleState = dynamicAttrState.get(handleId);
    if (handleState) {
      cleanupHandleState(handleState);
    }
  }
}

export function deleteMainThreadDynamicAttrStateForSubtree(
  handleIds: readonly number[],
): void {
  for (const handleId of handleIds) {
    const handleState = dynamicAttrState.get(handleId);
    if (handleState) {
      cleanupHandleState(handleState);
    }
    blockedMTRefAttachmentHandleIds.delete(handleId);
    dynamicAttrKindsByHandle.delete(handleId);
    dynamicAttrState.delete(handleId);
  }
}
