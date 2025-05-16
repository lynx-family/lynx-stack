// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { runWorkletCtx, updateWorkletRef as update } from '@lynx-js/react/worklet-runtime/bindings';
import type { Element, Worklet, WorkletRefId, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import type { SnapshotInstance } from '../snapshot.js';

function workletUnRef(value: Worklet | WorkletRefImpl<Element>): void {
  if ('_wvid' in value && (value._wvid as WorkletRefId) > 0) {
    update(value as WorkletRefImpl<Element>, null);
  } else if ('_wkltId' in value) {
    if (typeof value._unmount == 'function') {
      (value._unmount as () => void)();
    } else {
      runWorkletCtx(value, [null]);
    }
  }
}

function updateWorkletRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: WorkletRefImpl<Element> | Worklet | undefined,
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
    if ((value._wvid as WorkletRefId) > 0) {
      update(value as WorkletRefImpl<Element>, snapshot.__elements[elementIndex]!);
    }
  } else if ((value as Worklet)._wkltId) {
    (value as Worklet)._unmount = runWorkletCtx(value as Worklet, [{
      elementRefptr: (snapshot.__elements[elementIndex]!) as any,
    }]) as () => void;
  } else if (value._type === '__LEPUS__' || (value as Worklet)._lepusWorkletHash) {
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

export { updateWorkletRef, workletUnRef };
