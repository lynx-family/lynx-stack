// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Element, Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import type { SnapshotInstance } from '../snapshot.js';
import { workletUnRef } from './workletRef.js';
import { RefProxy } from '../lifecycle/ref/delay.js';

const refsToClear: Ref[] = [];
const refsToApply: (Ref | [snapshotInstanceId: number, expIndex: number])[] = [];

type Ref = (((ref: RefProxy) => (() => void) | void) | { current: RefProxy | null }) & {
  _unmount?: (() => void) | void;
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

// This function is modified from preact source code.
function applyRef(ref: Ref, value: null | [snapshotInstanceId: number, expIndex: number]): void {
  const newRef = value && new RefProxy(value);

  try {
    if (typeof ref == 'function') {
      const hasRefUnmount = typeof ref._unmount == 'function';
      if (hasRefUnmount) {
        ref._unmount!();
      }

      if (!hasRefUnmount || newRef != null) {
        // Store the cleanup function on the function
        // instance object itself to avoid shape
        // transitioning vnode
        ref._unmount = ref(newRef!);
      }
    } else ref.current = newRef;
    /* v8 ignore start */
  } catch (e) {
    lynx.reportError(e as Error);
  }
  /* v8 ignore stop */
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

function transformRef(ref: unknown): Ref | null | undefined {
  if (ref === undefined || ref === null) {
    return ref;
  }
  if (typeof ref === 'function' || (typeof ref === 'object' && 'current' in ref)) {
    if ('__ref' in ref) {
      return ref as Ref;
    }
    return Object.defineProperty(ref, '__ref', { value: 1 }) as Ref;
  }
  throw new Error(
    `Elements' "ref" property should be a function, or an object created `
      + `by createRef(), but got [${typeof ref}] instead`,
  );
}

function applyQueuedRefs(): void {
  try {
    for (const ref of refsToClear) {
      applyRef(ref, null);
    }
    for (let i = 0; i < refsToApply.length; i += 2) {
      const ref = refsToApply[i] as Ref;
      const value = refsToApply[i + 1] as [snapshotInstanceId: number, expIndex: number] | null;
      applyRef(ref, value);
    }
  } finally {
    clearQueuedRefs();
  }
}

function queueRefAttrUpdate(
  oldRef: Ref | null | undefined,
  newRef: Ref | null | undefined,
  snapshotInstanceId: number,
  expIndex: number,
): void {
  if (oldRef === newRef) {
    return;
  }
  if (oldRef) {
    refsToClear.push(oldRef);
  }
  if (newRef) {
    refsToApply.push(newRef, [snapshotInstanceId, expIndex]);
  }
}

function clearQueuedRefs(): void {
  refsToClear.length = 0;
  refsToApply.length = 0;
}

/**
 * @internal
 */
export { queueRefAttrUpdate, updateRef, unref, transformRef, applyRef, applyQueuedRefs, clearQueuedRefs, type Ref };
