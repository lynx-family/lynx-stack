// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  type Worklet,
  type WorkletRef,
  runWorkletCtx,
  updateWorkletRef as update,
} from '@lynx-js/react/worklet-runtime/bindings';

import { SnapshotInstance } from '../snapshot.js';

function workletUnRef(value: Worklet | WorkletRef<unknown>): void {
  if ('_wvid' in value) {
    update(value as any, null);
  } else if ('_wkltId' in value) {
    if (typeof value._unmount == 'function') {
      value._unmount();
    } else {
      runWorkletCtx(value as any, [null]);
    }
  }
}

function updateWorkletRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: any,
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

  const value = snapshot.__values![expIndex];
  if (value === null || value === undefined) {
    // do nothing
  } else if (value._wvid) {
    update(value as any, snapshot.__elements[elementIndex]!);
  } else if (value._wkltId) {
    // @ts-ignore
    value._unmount = runWorkletCtx(value as any, [{ elementRefptr: snapshot.__elements[elementIndex]! }]);
  } else if (value._type === '__LEPUS__' || value._lepusWorkletHash) {
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
