// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '@lynx-js/lynx-runtime/bts';
import type { Unsubscribe } from '@lynx-js/lynx-runtime/bts';

import { backgroundSnapshotInstanceManager } from '../../snapshot/backgroundSnapshot.js';
import { ctxNotFoundType } from '../constant.js';
import type { CtxNotFoundData, CtxNotFoundOptions } from '../constant.js';

export { ctxNotFoundType };
export type { CtxNotFoundData, CtxNotFoundOptions };

const errorMsg = 'snapshotPatchApply failed: ctx not found';

let unsubscribe: Unsubscribe | undefined;

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
  removeCtxNotFoundEventListener();
  /* v8 ignore start */
  if (!lynx.getCoreContext) {
    return;
  }
  /* v8 ignore stop */
  unsubscribe = bindPage().onMessage(ctxNotFoundType, reportCtxNotFound);
}

export function removeCtxNotFoundEventListener(): void {
  unsubscribe?.();
  unsubscribe = undefined;
}
