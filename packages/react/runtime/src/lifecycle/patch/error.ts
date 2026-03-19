// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { backgroundSnapshotInstanceManager, snapshotManager } from '../../snapshot.js';

export const ctxNotFoundType = 'Lynx.Error.CtxNotFound';

const errorMsg = 'snapshotPatchApply failed: ctx not found';

let ctxNotFoundEventListener: ((e: RuntimeProxy.Event) => void) | null = null;

export interface CtxNotFoundData {
  id: number;
}

export function sendCtxNotFoundEventToBackground(id: number): void {
  /* v8 ignore next 3 */
  if (!lynx.getJSContext) {
    throw new Error(errorMsg);
  }
  lynx.getJSContext().dispatchEvent({
    type: ctxNotFoundType,
    data: {
      id,
    } as CtxNotFoundData,
  });
}

export function reportCtxNotFound(data: CtxNotFoundData): void {
  const id = data.id;
  const instance = backgroundSnapshotInstanceManager.values.get(id);

  let snapshotType = 'null';

  if (instance && instance.__snapshot_def) {
    for (const [snapshotId, snapshot] of snapshotManager.values.entries()) {
      if (snapshot === instance.__snapshot_def) {
        snapshotType = snapshotId;
        break;
      }
    }
  }

  let message = `${errorMsg}, snapshot type: '${snapshotType}'`;
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
