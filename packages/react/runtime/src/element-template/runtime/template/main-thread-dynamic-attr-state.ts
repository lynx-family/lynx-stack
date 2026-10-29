// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { getMainThreadDynamicAttrSlotKinds } from './attr-slot-plan.js';
import { retainMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
import { isMTEventNativeWrapper } from './main-thread-event-ctx.js';
import type { MTEventCtx, MTEventNativeWrapper } from './main-thread-event-ctx.js';
import {
  attachMTRefValue,
  cleanupMTRefValue,
  hydrateMTRefValue,
  isMTRefNativeWrapper,
  retainMTRefValue,
} from './main-thread-ref-ctx.js';
import type { MTRefNativeWrapper, MTRefValue } from './main-thread-ref-ctx.js';
import { isMainThreadFunction } from '../../../core/main-thread-function.js';
import { isMainThreadRef } from '../../../core/main-thread-ref.js';
import { hydrateGestureCallbacks, isGestureSlotValue, retainGestureCallbacks } from '../../prop-adapters/gesture.js';
import type { GestureSlotValue } from '../../prop-adapters/gesture.js';
import { isMainThreadEventPropKey, isSpreadRecord } from '../../prop-adapters/spread.js';
import type { SerializableValue } from '../../protocol/types.js';

type MainThreadDynamicAttrState =
  | { kind: 'mt-event'; nativeHeldValue: MTEventCtx }
  | { kind: 'mt-ref'; value: MTRefValue };

type MainThreadDynamicAttrStateMap<T> = Map<number, Map<number, T>>;

interface SpreadSlotDynamicState {
  events?: Map<string, MTEventCtx> | undefined;
  gesture?: GestureSlotValue | undefined;
}

interface AttachedMTRefEntry {
  slotIndex: number;
  value: MTRefValue;
}

const gestureAttrState: MainThreadDynamicAttrStateMap<GestureSlotValue> = new Map();
const mtEventAttrState: MainThreadDynamicAttrStateMap<MTEventCtx> = new Map();
const mtRefAttrState: MainThreadDynamicAttrStateMap<MTRefValue> = new Map();
const mtRefSlotSpecs: MainThreadDynamicAttrStateMap<MTRefValue | null> = new Map();
const spreadAttrSlots = new Map<number, Set<number>>();
const spreadSlotState: MainThreadDynamicAttrStateMap<SpreadSlotDynamicState> = new Map();
const attachedMTRefHandleIds = new Set<number>();
const attachedMTRefsByElement = new Map<number, Map<ElementRef, AttachedMTRefEntry>>();

let pendingMTRefReconciliations = new Map<number, ElementTemplateHandle>();

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

function registerHandleSlot(
  slotsByHandle: Map<number, Set<number>>,
  handleId: number,
  attrSlotIndex: number,
): void {
  let slots = slotsByHandle.get(handleId);
  if (!slots) {
    slots = new Set();
    slotsByHandle.set(handleId, slots);
  }
  slots.add(attrSlotIndex);
}

function hasNonNullMTRefSpec(handleId: number): boolean {
  const specs = mtRefSlotSpecs.get(handleId);
  if (!specs) {
    return false;
  }
  for (const value of specs.values()) {
    if (value !== null) {
      return true;
    }
  }
  return false;
}

function isSameMTRefSpec(
  prev: MTRefValue | null | undefined,
  next: MTRefValue | null | undefined,
  isHydration: boolean,
): boolean {
  if (prev === next) {
    return true;
  }
  if (prev == null || next == null) {
    return false;
  }
  if (isMainThreadRef(prev) && isMainThreadRef(next)) {
    return prev._wvid === next._wvid;
  }
  return !isHydration
    && isMainThreadFunction(prev)
    && isMainThreadFunction(next)
    && prev._execId !== undefined
    && prev._execId === next._execId;
}

function cleanupAttachedElementsForHandle(handleId: number): void {
  const attachedElements = attachedMTRefsByElement.get(handleId);
  if (!attachedElements) {
    return;
  }
  attachedMTRefsByElement.delete(handleId);
  for (const entry of attachedElements.values()) {
    cleanupMTRefValue(entry.value);
  }
}

function cleanupAttachedElementsForSlot(handleId: number, attrSlotIndex: number): void {
  const attachedElements = attachedMTRefsByElement.get(handleId);
  if (!attachedElements) {
    return;
  }
  const toCleanup: MTRefValue[] = [];
  for (const [element, entry] of attachedElements) {
    if (entry.slotIndex === attrSlotIndex) {
      attachedElements.delete(element);
      toCleanup.push(entry.value);
    }
  }
  if (attachedElements.size === 0) {
    attachedMTRefsByElement.delete(handleId);
  }
  for (const value of toCleanup) {
    cleanupMTRefValue(value);
  }
}

function setMTEventSlotState(handleId: number, attrSlotIndex: number, nativeHeldValue: MTEventCtx): void {
  setSlotState(mtEventAttrState, handleId, attrSlotIndex, nativeHeldValue);
}

function setDirectMTRefSlotState(
  handleId: number,
  attrSlotIndex: number,
  value: MTRefValue,
): void {
  retainMTRefValue(value);
  setSlotState(mtRefAttrState, handleId, attrSlotIndex, value);
  setSlotState(mtRefSlotSpecs, handleId, attrSlotIndex, value);
}

export function isSpreadDynamicAttrSlot(
  handleId: number,
  attrSlotIndex: number,
): boolean {
  return spreadAttrSlots.get(handleId)?.has(attrSlotIndex) === true;
}

export function prepareSpreadAttrSlotForNative(
  value: unknown,
): SerializableValue | null {
  if (!isSpreadRecord(value)) {
    return null;
  }
  const keys = Object.keys(value);
  let hasOwnMTRef = false;
  let activeMTRefWrapper: MTRefNativeWrapper | undefined;
  for (const key of keys) {
    const entry = value[key];
    if (key === 'main-thread:ref') {
      hasOwnMTRef = true;
      if (isMTRefNativeWrapper(entry)) {
        activeMTRefWrapper = entry;
        retainMTRefValue(entry.value);
      }
    } else if (key === 'main-thread:gesture') {
      if (isGestureSlotValue(entry)) {
        retainGestureCallbacks(entry);
      }
    } else if (isMainThreadEventPropKey(key) && isMTEventNativeWrapper(entry)) {
      retainMainThreadBackgroundFunctionCtx(entry.value);
    }
  }
  if (!hasOwnMTRef) {
    return value as SerializableValue;
  }
  const nativeSpread: Record<string, SerializableValue> = {};
  for (const key of keys) {
    if (key !== 'main-thread:ref') {
      nativeSpread[key] = value[key] as SerializableValue;
    }
  }
  if (activeMTRefWrapper) {
    nativeSpread['has-react-ref'] = true;
    nativeSpread['flatten'] = false;
  }
  return nativeSpread;
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
      retainMainThreadBackgroundFunctionCtx((attributeSlots[attrSlotIndex] as MTEventNativeWrapper).value);
      continue;
    }
    if (kind === 'spread') {
      const slotValue = attributeSlots[attrSlotIndex];
      const nativeSpread = prepareSpreadAttrSlotForNative(slotValue);
      if (nativeSpread !== slotValue) {
        nativeSlots ??= attributeSlots.slice() as SerializableValue[];
        nativeSlots[attrSlotIndex] = nativeSpread;
      }
      continue;
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
  const attachedHandleIds = Array.from(attachedMTRefHandleIds);
  attachedMTRefHandleIds.clear();
  pendingMTRefReconciliations.clear();
  try {
    for (const handleId of attachedHandleIds) {
      cleanupAttachedElementsForHandle(handleId);
    }
  } finally {
    gestureAttrState.clear();
    mtEventAttrState.clear();
    mtRefAttrState.clear();
    mtRefSlotSpecs.clear();
    spreadAttrSlots.clear();
    spreadSlotState.clear();
    attachedMTRefsByElement.clear();
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

function commitSpreadSlotState(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  isHydration: boolean,
  cleanupBeforeRefHydrate = false,
): { prevSpec: MTRefValue | null | undefined; nextSpec: MTRefValue | null | undefined } {
  const prevSpread = isHydration ? spreadSlotState.get(handleId)?.get(attrSlotIndex) : undefined;
  const prevSpec = mtRefSlotSpecs.get(handleId)?.get(attrSlotIndex);

  let nextEvents: Map<string, MTEventCtx> | undefined;
  let nextGesture: GestureSlotValue | undefined;
  let hasOwnMTRef = false;
  let nextRefValue: MTRefValue | null = null;

  if (isSpreadRecord(value)) {
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (key === 'main-thread:ref') {
        hasOwnMTRef = true;
        nextRefValue = isMTRefNativeWrapper(entry) ? entry.value : null;
      } else if (key === 'main-thread:gesture') {
        if (isGestureSlotValue(entry)) {
          nextGesture = entry;
        }
      } else if (isMainThreadEventPropKey(key) && isMTEventNativeWrapper(entry)) {
        (nextEvents ??= new Map()).set(key, entry.value);
      }
    }
  }

  if (nextEvents || nextGesture) {
    setSlotState(spreadSlotState, handleId, attrSlotIndex, {
      events: nextEvents,
      gesture: nextGesture,
    });
  } else {
    deleteSlotState(spreadSlotState, handleId, attrSlotIndex);
  }

  const rawNextSpec = hasOwnMTRef ? nextRefValue : undefined;
  const nextSpec = isSameMTRefSpec(prevSpec, rawNextSpec, isHydration) ? prevSpec : rawNextSpec;

  if (cleanupBeforeRefHydrate && prevSpec !== nextSpec) {
    cleanupAttachedElementsForSlot(handleId, attrSlotIndex);
  }

  if (isHydration) {
    if (nextEvents && prevSpread?.events) {
      for (const [eventKey, nextCtx] of nextEvents) {
        const prevCtx = prevSpread.events.get(eventKey);
        if (prevCtx) {
          hydrateWorkletCtx(nextCtx as Worklet, prevCtx as Worklet);
        }
      }
    }
    if (nextGesture && prevSpread?.gesture) {
      hydrateGestureCallbacks(nextGesture, prevSpread.gesture);
    }
    if (nextRefValue !== null) {
      hydrateMTRefValue(nextRefValue, prevSpec);
    }
  }

  if (nextSpec === undefined) {
    deleteSlotState(mtRefSlotSpecs, handleId, attrSlotIndex);
  } else {
    setSlotState(mtRefSlotSpecs, handleId, attrSlotIndex, nextSpec);
  }

  return { prevSpec, nextSpec };
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
    } else if (kind === 'mt-ref') {
      if (value == null) {
        setSlotState(mtRefSlotSpecs, handleId, attrSlotIndex, null);
      } else {
        setDirectMTRefSlotState(handleId, attrSlotIndex, (value as MTRefNativeWrapper).value);
      }
    } else if (kind === 'spread') {
      registerHandleSlot(spreadAttrSlots, handleId, attrSlotIndex);
      commitSpreadSlotState(handleId, attrSlotIndex, value, false);
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
  retainGestureCallbacks(next);
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
  if (isAttached) {
    cleanupAttachedElementsForSlot(handleId, attrSlotIndex);
  }
  if (value == null) {
    deleteSlotState(mtRefAttrState, handleId, attrSlotIndex);
    setSlotState(mtRefSlotSpecs, handleId, attrSlotIndex, null);
    return;
  }
  const nextValue = (value as MTRefNativeWrapper).value;
  setDirectMTRefSlotState(handleId, attrSlotIndex, nextValue);
  if (isHydration) {
    hydrateMTRefValue(nextValue, previousState);
  }
  if (isAttached) {
    pendingMTRefReconciliations.set(handleId, nativeRef);
  }
}

export function updateSpreadAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
  nativeRef: ElementTemplateHandle,
  isHydration = false,
): void {
  const isAttached = attachedMTRefHandleIds.has(handleId);
  const { prevSpec, nextSpec } = commitSpreadSlotState(
    handleId,
    attrSlotIndex,
    value,
    isHydration,
    isAttached,
  );
  if (prevSpec === nextSpec) {
    return;
  }
  if (isAttached && hasNonNullMTRefSpec(handleId)) {
    pendingMTRefReconciliations.set(handleId, nativeRef);
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
    if (hasNonNullMTRefSpec(handle.uid)) {
      pendingMTRefReconciliations.set(handle.uid, handle.ref);
    }
  }
}

// Consume one queue snapshot, matching Snapshot's ref delivery boundary.
export function applyPendingMainThreadRefAttachments(): void {
  if (pendingMTRefReconciliations.size === 0) {
    return;
  }
  const pending = pendingMTRefReconciliations;
  pendingMTRefReconciliations = new Map();

  for (const [handleId, nativeRef] of pending) {
    const specs = mtRefSlotSpecs.get(handleId);
    const desiredByElement = new Map<ElementRef, AttachedMTRefEntry | null>();
    if (specs && specs.size > 0) {
      const sortedEntries = specs.size === 1
        ? Array.from(specs.entries())
        : Array.from(specs.entries()).sort((a, b) => a[0] - b[0]);
      for (const [slotIndex, refValue] of sortedEntries) {
        const element = __GetElementByAttrSlot(nativeRef, slotIndex);
        if (!element) {
          throw new Error(
            `ElementTemplate main-thread:ref target ${handleId}:${slotIndex} could not be materialized.`,
          );
        }
        desiredByElement.set(
          element,
          refValue === null ? null : { slotIndex, value: refValue },
        );
      }
    }

    let attachedElements = attachedMTRefsByElement.get(handleId);
    if (attachedElements) {
      const staleValues: MTRefValue[] = [];
      for (const [element, prevEntry] of attachedElements) {
        const desired = desiredByElement.get(element) ?? null;
        if (!desired || desired.slotIndex !== prevEntry.slotIndex || desired.value !== prevEntry.value) {
          attachedElements.delete(element);
          staleValues.push(prevEntry.value);
        }
      }
      if (attachedElements.size === 0) {
        attachedMTRefsByElement.delete(handleId);
        attachedElements = undefined;
      }
      for (const staleValue of staleValues) {
        cleanupMTRefValue(staleValue);
      }
    }

    for (const [element, desired] of desiredByElement) {
      if (!desired) {
        continue;
      }
      if (attachedElements?.has(element)) {
        continue;
      }
      if (!attachedElements) {
        attachedElements = new Map();
        attachedMTRefsByElement.set(handleId, attachedElements);
      }
      attachedElements.set(element, desired);
      attachMTRefValue(desired.value, element);
    }
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
    pendingMTRefReconciliations.delete(handleId);
    cleanupAttachedElementsForHandle(handleId);
  }
}

export function deleteMainThreadDynamicAttrStateForSubtree(
  handleIds: readonly number[],
): void {
  for (const handleId of handleIds) {
    const wasAttached = attachedMTRefHandleIds.delete(handleId);
    pendingMTRefReconciliations.delete(handleId);
    if (wasAttached) {
      cleanupAttachedElementsForHandle(handleId);
    } else {
      attachedMTRefsByElement.delete(handleId);
    }
    gestureAttrState.delete(handleId);
    mtEventAttrState.delete(handleId);
    mtRefAttrState.delete(handleId);
    mtRefSlotSpecs.delete(handleId);
    spreadAttrSlots.delete(handleId);
    spreadSlotState.delete(handleId);
  }
}
