// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { backgroundSnapshotInstanceManager } from '../../snapshot/backgroundSnapshot.js';

export const ctxNotFoundType = 'Lynx.Error.CtxNotFound';

const errorMsg = 'snapshotPatchApply failed: ctx not found';

let ctxNotFoundEventListener: ((e: RuntimeProxy.Event) => void) | null = null;

export interface CtxNotFoundOptions {
  operation: string;
  commitId: number;
  isHydration: boolean;
  parent?: number;
  child?: number;
  /** Missing main-thread contexts: 1 for parent, 2 for child, 3 for both. */
  missingNode?: 1 | 2 | 3;
}

export interface CtxNotFoundData {
  id: number;
  options: CtxNotFoundOptions;
}

export function sendCtxNotFoundEventToBackground(id: number, options: CtxNotFoundOptions): void {
  if (!lynx.getJSContext) {
    throw new Error(errorMsg);
  }
  lynx.getJSContext().dispatchEvent({
    type: ctxNotFoundType,
    data: { id, options },
  });
}

export function reportCtxNotFound(data: CtxNotFoundData): void {
  const { id, options } = data;
  const instance = backgroundSnapshotInstanceManager.values.get(id);
  const snapshotType = instance?.__snapshot_def ? instance.type ?? 'null' : 'null';
  const { operation, commitId, isHydration, child, missingNode } = options;
  const parent = options.parent ?? instance?.parentNode?.__id;
  let parentInfo = 'parent: null';
  if (parent !== undefined) {
    const parentInstance = backgroundSnapshotInstanceManager.values.get(parent);
    const parentType = parentInstance?.__snapshot_def ? parentInstance.type ?? 'null' : 'null';
    const missingInfo = missingNode === undefined
      ? ''
      : `, missing: ${missingNode === 1 || missingNode === 3}`;
    parentInfo = `parent: { id: ${parent}, snapshot type: '${parentType}'${missingInfo} }`;
  }
  let ctxInfo = parentInfo;
  if (child !== undefined) {
    const childInstance = backgroundSnapshotInstanceManager.values.get(child);
    const childType = childInstance?.__snapshot_def ? childInstance.type ?? 'null' : 'null';
    const missingInfo = missingNode === undefined
      ? ''
      : `, missing: ${missingNode === 2 || missingNode === 3}`;
    ctxInfo = `${parentInfo}, child: { id: ${child}, snapshot type: '${childType}'${missingInfo} }`;
  }
  let message =
    `${errorMsg}, snapshot type: '${snapshotType}', ${ctxInfo}, operation: '${operation}', commitId: ${commitId}, isHydration: ${isHydration}`;
  if (__DEV__) {
    message += '. You can set environment variable `REACT_ALOG=true` and restart your dev server for troubleshooting.';
  }
  lynx.reportError(new Error(message));
}

export function addCtxNotFoundEventListener(): void {
  ctxNotFoundEventListener = (e) => {
    reportCtxNotFound(e.data as CtxNotFoundData);
  };
  lynx.getCoreContext?.().addEventListener(ctxNotFoundType, ctxNotFoundEventListener);
}

export function removeCtxNotFoundEventListener(): void {
  const coreContext = lynx.getCoreContext?.();
  if (coreContext && ctxNotFoundEventListener) {
    coreContext.removeEventListener(ctxNotFoundType, ctxNotFoundEventListener);
    ctxNotFoundEventListener = null;
  }
}
