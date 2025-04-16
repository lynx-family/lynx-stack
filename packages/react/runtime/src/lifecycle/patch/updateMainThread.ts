// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clearDelayedWorklets, updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';

import { LifecycleConstant } from '../../lifecycleConstant.js';
import { __pendingListUpdates } from '../../list.js';
import { PerformanceTimingKeys, markTiming, setPipeline } from '../../lynx/performance.js';
import { __page } from '../../snapshot.js';
import { getReloadVersion } from '../pass.js';
import type { PatchList, PatchOptions } from './commit.js';
import { snapshotPatchApply } from './snapshotPatchApply.js';

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
  markTiming(PerformanceTimingKeys.parse_changes_start);
  const { patchList, flushOptions = {} } = JSON.parse(data) as PatchList;

  markTiming(PerformanceTimingKeys.parse_changes_end);
  markTiming(PerformanceTimingKeys.patch_changes_start);

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
  markTiming(PerformanceTimingKeys.patch_changes_end);
  if (patchOptions.isHydration) {
    clearDelayedWorklets();
  }
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
