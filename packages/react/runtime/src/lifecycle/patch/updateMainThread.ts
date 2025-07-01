// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';

import type { PatchList, PatchOptions } from './commit.js';
import { setMainThreadHydrationFinished } from './isMainThreadHydrationFinished.js';
import { snapshotPatchApply } from './snapshotPatchApply.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';
import { markTiming, setPipeline } from '../../lynx/performance.js';
import { __pendingListUpdates } from '../../pendingListUpdates.js';
import { applyRefQueue } from '../../snapshot/workletRef.js';
import { __page } from '../../snapshot.js';
import { getReloadVersion } from '../pass.js';

function updateMainThread(
  { data, patchOptions }: {
    data: string;
    patchOptions: PatchOptions;
  },
): void {
  if ((patchOptions.reloadVersion) < getReloadVersion()) {
    return;
  }

  setPipeline(patchOptions.pipelineOptions);
  markTiming('mtsRenderStart');
  markTiming('parseChangesStart');
  const { patchList, flushOptions = {} } = JSON.parse(data) as PatchList;

  markTiming('parseChangesEnd');
  markTiming('patchChangesStart');

  for (const { snapshotPatch, workletRefInitValuePatch } of patchList) {
    updateWorkletRefInitValueChanges(workletRefInitValuePatch);
    __pendingListUpdates.clear();
    if (snapshotPatch) {
      snapshotPatchApply(snapshotPatch);
    }
    __pendingListUpdates.flush();
    // console.debug('********** Lepus updatePatch:');
    // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
  }
  markTiming('patchChangesEnd');
  markTiming('mtsRenderEnd');
  if (patchOptions.isHydration) {
    setMainThreadHydrationFinished(true);
  }
  applyRefQueue();
  if (patchOptions.pipelineOptions) {
    flushOptions.pipelineOptions = patchOptions.pipelineOptions;
  }
  // TODO: triggerDataUpdated?
  __FlushElementTree(__page, flushOptions);
}

function injectUpdateMainThread(): void {
  Object.assign(globalThis, { [LifecycleConstant.patchUpdate]: updateMainThread });
}

/**
 * @internal
 */
export { injectUpdateMainThread };
