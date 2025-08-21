// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RefCallback, RefObject } from 'preact';

import { onWorkletCtxUpdate, runWorkletCtx, updateWorkletRef as update } from '@lynx-js/react/worklet-runtime/bindings';
import type { Element, Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { isMainThreadHydrating } from '../lifecycle/patch/isMainThreadHydrating.js';
import type { SnapshotInstance } from '../snapshot.js';

type Ref = WorkletRefImpl<Element> | Worklet | RefObject<Element> | RefCallback<Element>;

let mtRefQueue: (Ref | Element)[] = [];

export function applyRefQueue(): void {
  const queue = mtRefQueue;
  mtRefQueue = [];
  for (let i = 0; i < queue.length; i += 2) {
    const worklet = queue[i] as Ref;
    const element = queue[i + 1] as Element;
    if ('_wvid' in worklet) {
      update(worklet as WorkletRefImpl<Element>, element);
    } else if ('_wkltId' in worklet) {
      worklet._unmount = runWorkletCtx(worklet, [{ elementRefptr: element }]) as () => void;
    } else if ('current' in worklet) {
      worklet.current = element;
    } else if (typeof worklet === 'function') {
      // @ts-ignore
      worklet._unmount = worklet(element);
    } else {
      // @ts-ignore
      worklet(element);
    }
  }
}

export function addToRefQueue(worklet: Ref, element: Element): void {
  mtRefQueue.push(worklet, element);
}

export function workletUnRef(value: Ref): void {
  // console.log('yra workletUnRef', value);
  if ('_wvid' in value) {
    update(value as WorkletRefImpl<Element>, null);
  } else if ('_wkltId' in value) {
    if (typeof value._unmount == 'function') {
      (value._unmount as () => void)();
    } else {
      runWorkletCtx(value, [null]);
    }
  } else if ('current' in value) {
    value.current = null;
  } else if (typeof value === 'function') {
    // @ts-ignore
    if (typeof value._unmount == 'function') {
      // @ts-ignore
      (value._unmount as () => void)();
    } else {
      value(null);
    }
  }
}

export function updateWorkletRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: WorkletRefImpl<Element> | Worklet | null | undefined,
  elementIndex: number,
  _workletType: string,
): void {
  if (!snapshot.__elements) {
    return;
  }

  if (oldValue && snapshot.__worklet_ref_set?.has(oldValue)) {
    workletUnRef(oldValue);
    snapshot.__worklet_ref_set?.delete(oldValue);
  }

  const value = snapshot.__values![expIndex] as (WorkletRefImpl<Element> | Worklet | undefined);
  if (value === null || value === undefined) {
    // do nothing
  } else if (value._wvid) {
    const element = snapshot.__elements[elementIndex]! as Element;
    addToRefQueue(value as Worklet, element);
  } else if ((value as Worklet)._wkltId) {
    const element = snapshot.__elements[elementIndex]! as Element;
    onWorkletCtxUpdate(
      value as Worklet,
      oldValue as Worklet | undefined,
      isMainThreadHydrating,
      element,
    );
    addToRefQueue(value as Worklet, element);
    /* v8 ignore next 3 */
  } else if (value._type === '__LEPUS__' || (value as Worklet)._lepusWorkletHash) {
    // for pre-0.99 compatibility
    // During the initial render, we will not update the WorkletRef because the background thread is not ready yet.
  } else {
    throw new Error('MainThreadRef: main-thread:ref must be of type MainThreadRef or main-thread function.');
  }

  if (value) {
    snapshot.__worklet_ref_set ??= new Set();
    snapshot.__worklet_ref_set.add(value);
  }
  // Add an arbitrary attribute to avoid this element being layout-only
  __SetAttribute(snapshot.__elements[elementIndex]!, 'has-react-ref', true);
}
