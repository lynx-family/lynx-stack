// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType } from '@lynx-js/react/worklet-runtime/bindings';
import { runRunOnMainThreadTask, setEomShouldFlushElementTree } from '@lynx-js/react/worklet-runtime/bindings';

import type { PatchList, PatchOptions } from './commit.js';
import { setMainThreadHydrating } from './isMainThreadHydrating.js';
import { snapshotPatchApply } from './snapshotPatchApply.js';
import { prettyFormatSnapshotPatch } from '../../debug/formatPatch.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';
import { markTiming, setPipeline } from '../../lynx/performance.js';
import { __pendingListUpdates } from '../../pendingListUpdates.js';
import { applyRefQueue } from '../../snapshot/workletRef.js';
import { __page } from '../../snapshot.js';
import { isMtsEnabled } from '../../worklet/functionality.js';
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

  const flowIds = patchOptions.flowIds;
  if (flowIds) {
    lynx.performance.profileStart('ReactLynx::patch', {
      flowId: flowIds[0],
      flowIds,
    });
  }

  setPipeline(patchOptions.pipelineOptions);
  markTiming('mtsRenderStart');
  markTiming('parseChangesStart');
  const parsedData = JSON.parse(data) as PatchList;
  const { patchList, flushOptions = {}, delayedRunOnMainThreadData } = parsedData;

  if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
    console.alog?.(
      '[ReactLynxDebug] BTS -> MTS updateMainThread:\n' + JSON.stringify(
        {
          data: {
            ...parsedData,
            patchList: parsedData.patchList.map(patch => ({
              ...patch,
              snapshotPatch: prettyFormatSnapshotPatch(patch.snapshotPatch),
            })),
          },
          patchOptions,
        },
        null,
        2,
      ),
    );
  }

  markTiming('parseChangesEnd');
  markTiming('patchChangesStart');
  if (patchOptions.isHydration) {
    setMainThreadHydrating(true);
  }
  try {
    for (const { snapshotPatch } of patchList) {
      __pendingListUpdates.clearAttachedLists();
      if (snapshotPatch) {
        snapshotPatchApply(snapshotPatch);
      }
      __pendingListUpdates.flush();
      // console.debug('********** Lepus updatePatch:');
      // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
    }
  } finally {
    markTiming('patchChangesEnd');
    markTiming('mtsRenderEnd');
    if (patchOptions.isHydration) {
      setMainThreadHydrating(false);
    }
  }
  applyRefQueue();
  if (delayedRunOnMainThreadData && isMtsEnabled()) {
    setEomShouldFlushElementTree(false);
    for (const data of delayedRunOnMainThreadData) {
      try {
        runRunOnMainThreadTask(data.worklet, data.params as ClosureValueType[], data.resolveId);
        /* v8 ignore next 3 */
      } catch (e) {
        lynx.reportError(e as Error);
      }
    }
    setEomShouldFlushElementTree(true);
  }
  if (patchOptions.pipelineOptions) {
    flushOptions.pipelineOptions = patchOptions.pipelineOptions;
  }
  __FlushElementTree(__page, flushOptions);

  if (flowIds) {
    lynx.performance.profileEnd();
  }
}

function injectUpdateMainThread(): void {
  Object.assign(globalThis, { [LifecycleConstant.patchUpdate]: updateMainThread });
}

/**
 * @internal
 */
export { injectUpdateMainThread };
