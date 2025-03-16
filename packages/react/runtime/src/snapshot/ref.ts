// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet, WorkletRef } from '@lynx-js/react/worklet-runtime/bindings';

import { nextCommitTaskId } from '../lifecycle/patch/commit.js';
import { SnapshotInstance, backgroundSnapshotInstanceManager } from '../snapshot.js';
import { workletUnRef } from './workletRef.js';

let globalRefPatch: Record<string, number | null> = {};
const globalRefsToRemove: Map</* commitId */ number, Map</* sign */ string, /* ref */ any>> = /* @__PURE__ */ new Map();
const globalRefsToSet: Map</* commitId */ number, Record<string, number>> = /* @__PURE__ */ new Map();
let nextRefId = 1;

function unref(snapshot: SnapshotInstance, recursive: boolean): void {
  snapshot.__ref_set?.forEach(v => {
    globalRefPatch[v] = null;
  });
  snapshot.__ref_set?.clear();

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

function applyRef(ref: any, value: any) {
  // TODO: ref: exceptions thrown in user functions should be able to be caught by an Error Boundary
  if (typeof ref == 'function') {
    const hasRefUnmount = typeof ref._unmount == 'function';
    if (hasRefUnmount) {
      // @ts-ignore TS doesn't like moving narrowing checks into variables
      ref._unmount();
    }

    if (!hasRefUnmount || value != null) {
      // Store the cleanup function on the function
      // instance object itself to avoid shape
      // transitioning vnode
      ref._unmount = ref(value);
    }
  } else ref.current = value;
}

function updateBackgroundRefs(commitId: number): void {
  const oldRefMap = globalRefsToRemove.get(commitId);
  if (oldRefMap) {
    globalRefsToRemove.delete(commitId);
    for (const ref of oldRefMap.values()) {
      applyRef(ref, null);
    }
  }
  const newRefMap = globalRefsToSet.get(commitId);
  if (newRefMap) {
    globalRefsToSet.delete(commitId);
    for (const sign in newRefMap) {
      const ref = backgroundSnapshotInstanceManager.getValueBySign(sign);
      if (ref) {
        // TODO: ref: support __REF_FIRE_IMMEDIATELY__
        const v = newRefMap[sign] && lynx.createSelectorQuery().selectUniqueID(newRefMap[sign]);
        applyRef(ref, v);
      }
    }
  }
}

function updateRef(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: any,
  elementIndex: number,
  spreadKey: string,
): void {
  const value = snapshot.__values![expIndex];
  let ref;
  if (!value) {
    ref = undefined;
  } else if (typeof value === 'string') {
    ref = value;
  } else {
    ref = `${snapshot.__id}:${expIndex}:${spreadKey}`;
  }

  snapshot.__values![expIndex] = ref;
  if (snapshot.__elements && ref) {
    __SetAttribute(snapshot.__elements[elementIndex]!, 'has-react-ref', true);
    const uid = __GetElementUniqueID(snapshot.__elements[elementIndex]!);
    globalRefPatch[ref] = uid;
    snapshot.__ref_set ??= new Set();
    snapshot.__ref_set.add(ref);
  }
  if (oldValue !== ref) {
    snapshot.__ref_set?.delete(oldValue);
  }
}

function takeGlobalRefPatchMap(): Record<string, number | null> {
  const patch = globalRefPatch;
  globalRefPatch = {};
  return patch;
}

function transformRef(ref: unknown): Function | (object & Record<'current', unknown>) | null | undefined {
  if (ref === undefined || ref === null) {
    return ref;
  }
  if (typeof ref === 'function' || (typeof ref === 'object' && 'current' in ref)) {
    if ('__ref' in ref) {
      return ref;
    }
    return Object.defineProperty(ref, '__ref', { value: nextRefId++ });
  }
  throw new Error(
    `Elements' "ref" property should be a function, or an object created `
      + `by createRef(), but got [${typeof ref}] instead`,
  );
}

function markRefToRemove(sign: string, ref: unknown): void {
  if (!ref) {
    return;
  }
  let oldRefs = globalRefsToRemove.get(nextCommitTaskId);
  if (!oldRefs) {
    oldRefs = new Map();
    globalRefsToRemove.set(nextCommitTaskId, oldRefs);
  }
  oldRefs.set(sign, ref);
}

export {
  updateRef,
  takeGlobalRefPatchMap,
  updateBackgroundRefs,
  unref,
  transformRef,
  globalRefsToRemove,
  globalRefsToSet,
  markRefToRemove,
};
