// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Element, Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { workletUnRef } from './workletRef.js';
import { OrdinaryRefEffectQueue, applyOrdinaryRef, normalizeRefValue } from '../../core/ref.js';
import type { OrdinaryRef } from '../../core/ref.js';
import { RefProxy } from '../lifecycle/ref/delay.js';
import type { SnapshotInstance } from '../snapshot/snapshot.js';

type RefToken = [snapshotInstanceId: number, expIndex: number];

const refEffectQueue = /*#__PURE__*/ new OrdinaryRefEffectQueue<RefProxy, RefToken>();

type Ref = OrdinaryRef<RefProxy> & {
  __ref?: { value: number };
};

function unref(snapshot: SnapshotInstance, recursive: boolean): void {
  snapshot.__worklet_ref_set?.forEach(v => {
    if (v) {
      workletUnRef(v as Worklet | WorkletRefImpl<Element>);
    }
  });
  snapshot.__worklet_ref_set?.clear();

  if (recursive) {
    snapshot.childNodes.forEach(it => {
      unref(it, recursive);
    });
  }
}

function clearRef(ref: Ref): void {
  applyOrdinaryRef(ref, null);
}

function updateRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: string | null,
  elementIndex: number,
): void {
  const value: unknown = snapshot.__values![expIndex];
  let ref;
  if (typeof value === 'string') {
    ref = value;
  } else {
    ref = `react-ref-${snapshot.__id}-${expIndex}`;
  }

  snapshot.__values![expIndex] = ref;
  if (snapshot.__elements && oldValue !== ref) {
    if (oldValue) {
      __SetAttribute(snapshot.__elements[elementIndex]!, oldValue, undefined);
    }
    if (ref) {
      __SetAttribute(snapshot.__elements[elementIndex]!, ref, 1);
    }
  }
}

function getRefFromValue(val: unknown): Ref | null {
  if (!val || (typeof val !== 'object' && typeof val !== 'function')) {
    return null;
  }
  if ('__spread' in val && 'ref' in val) {
    return ((val as { ref?: Ref | null }).ref) ?? null;
  }
  if ('__ref' in val) {
    return val as Ref;
  }
  return null;
}

function transformRef(ref: unknown): Ref | null | undefined {
  const validRef = normalizeRefValue<RefProxy>(ref);
  if (validRef === undefined || validRef === null) {
    return validRef;
  }
  if ('__ref' in validRef) {
    return validRef as Ref;
  }
  return Object.defineProperty(validRef, '__ref', { value: 1 }) as Ref;
}

function applyQueuedRefs(): void {
  if (!refEffectQueue.hasPending()) {
    return;
  }
  refEffectQueue.flush(value => new RefProxy(value));
}

function queueRefAttrUpdate(
  oldRef: Ref | null | undefined,
  newRef: Ref | null | undefined,
  snapshotInstanceId: number,
  expIndex: number,
): void {
  refEffectQueue.queue(oldRef, newRef, [snapshotInstanceId, expIndex]);
}

function clearQueuedRefs(): void {
  refEffectQueue.clear();
}

/**
 * @internal
 */
export {
  queueRefAttrUpdate,
  updateRef,
  unref,
  transformRef,
  clearRef,
  applyQueuedRefs,
  clearQueuedRefs,
  getRefFromValue,
  type Ref,
};
