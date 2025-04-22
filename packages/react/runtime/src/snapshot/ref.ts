// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet, WorkletRef } from '@lynx-js/react/worklet-runtime/bindings';

import type { SnapshotInstance } from '../snapshot.js';
import { workletUnRef } from './workletRef.js';
import { RefProxy } from '../lifecycle/ref/delay.js';

type Ref = (((ref: RefProxy) => () => void) | { current: RefProxy | null }) & {
  _unmount?: () => void;
};

function unref(snapshot: SnapshotInstance, recursive: boolean): void {
  snapshot.__worklet_ref_set?.forEach(v => {
    if (v) {
      workletUnRef(v as Worklet | WorkletRef<unknown>);
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
function applyRef(ref: Ref, value: null | [number, number]): void {
  const newRef = value && new RefProxy(value);

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
}

function updateRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  _oldValue: any,
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
  if (snapshot.__elements && ref) {
    __SetAttribute(snapshot.__elements[elementIndex]!, ref, 1);
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

/**
 * Applies refs from a snapshot instance to their corresponding DOM elements.
 *
 * This function is called directly by preact with a `this` context of a Ref array that collects all
 * refs that are applied during the process.
 *
 * @param snapshotInstance - The snapshot instance containing refs to apply
 *
 * If snapshotInstance is null, all previously collected refs are cleared.
 * Otherwise, it iterates through the snapshot values, finds refs (either direct or in spreads),
 * and applies them to their corresponding elements.
 */
function applyRefs(this: Ref[], snapshotInstance: SnapshotInstance): void {
  if (__LEPUS__) {
    // for testing environment only
    return;
  }

  if (snapshotInstance == null) {
    try {
      this.forEach(ref => {
        applyRef(ref, null);
      });
    } finally {
      this.length = 0;
    }
    return;
  }

  for (let i = 0; i < snapshotInstance.__values!.length; i++) {
    const value: unknown = snapshotInstance.__values![i];
    if (!value || (typeof value !== 'function' && typeof value !== 'object')) {
      continue;
    }

    let ref: Ref | undefined;
    if ('__ref' in value) {
      ref = value as Ref;
    } else if ('__spread' in value) {
      ref = (value as { ref?: Ref | undefined }).ref;
    }

    if (ref) {
      applyRef(ref, [snapshotInstance.__id, i]);
      this.push(ref);
    }
  }
}

/**
 * @internal
 */
export { updateRef, unref, transformRef, applyRef, applyRefs };
