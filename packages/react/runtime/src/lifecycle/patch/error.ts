// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { backgroundSnapshotInstanceManager, snapshotManager } from '../../snapshot.js';

export const ctxNotFoundType = 'Lynx.Error.CtxNotFound';

const errorMsg = 'snapshotPatchApply failed: ctx not found';

export interface CtxNotFoundData {
  id: number;
}

export function sendCtxNotFoundEventToBackground(id: number): void {
  const error = new Error(errorMsg);
  /* v8 ignore next 3 */
  if (!lynx.getJSContext) {
    throw error;
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

  const snapshotDef = [...snapshotManager.values.entries()]
    .filter(({ 1: v }) => v === instance?.__snapshot_def)
    .map(([k]) => k);

  const snapshotType = snapshotDef[0] ?? 'null';
  const error = new Error(`${errorMsg}, snapshot type: '${snapshotType}'`);
  lynx.reportError(error);
}

export function addCtxNotFoundEventListener(): void {
  lynx.getCoreContext?.().addEventListener(ctxNotFoundType, e => {
    reportCtxNotFound(e.data as CtxNotFoundData);
  });
}
