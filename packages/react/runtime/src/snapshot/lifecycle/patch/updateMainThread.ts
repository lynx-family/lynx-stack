// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType } from '@lynx-js/react/worklet-runtime/bindings';
import { runRunOnMainThreadTask, setEomShouldFlushElementTree } from '@lynx-js/react/worklet-runtime/bindings';

import type { PatchList, PatchOptions } from './commit.js';
import { setMainThreadHydrating } from './isMainThreadHydrating.js';
import { snapshotPatchApply } from './snapshotPatchApply.js';
import { markTiming, setPipeline } from '../../../core/performance.js';
import { getReloadVersion } from '../../../core/reload-version.js';
import { prettyFormatSnapshotPatch } from '../../debug/formatPatch.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';
import { __pendingListUpdates } from '../../list/pendingListUpdates.js';
import { __page } from '../../snapshot/definition.js';
import { applyRefQueue, getRefQueueLength, truncateRefQueue } from '../../snapshot/workletRef.js';
import { isMtsEnabled } from '../../worklet/functionality.js';

function updateMainThread(
  { data, patchOptions }: {
    data: string | PatchList;
    patchOptions: PatchOptions;
  },
  partialHydration?: boolean,
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
  try {
    markTiming('mtsRenderStart');
    markTiming('parseChangesStart');
    const parsedData = typeof data === 'string' ? JSON.parse(data) as PatchList : data;
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
    const refQueueStart = getRefQueueLength();
    if (patchOptions.isHydration) {
      setMainThreadHydrating(true);
    }
    let patchApplied = false;
    let hydrationCompleted = false;
    try {
      for (const { snapshotPatch, id } of patchList) {
        __pendingListUpdates.clearAttachedLists();
        if (snapshotPatch) {
          snapshotPatchApply(snapshotPatch, id, patchOptions.isHydration === true);
        }
        __pendingListUpdates.flush();
        // console.debug('********** Lepus updatePatch:');
        // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
      }
      patchApplied = true;
    } finally {
      markTiming('patchChangesEnd');
      markTiming('mtsRenderEnd');
      try {
        if (patchOptions.isHydration) {
          setMainThreadHydrating(false, partialHydration, !patchApplied);
        }
        hydrationCompleted = patchApplied;
      } finally {
        if (!hydrationCompleted) {
          truncateRefQueue(refQueueStart);
        }
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
  } finally {
    setPipeline(undefined);
  }
}

function injectUpdateMainThread(): void {
  Object.assign(globalThis, { [LifecycleConstant.patchUpdate]: updateMainThread });
}

/**
 * @internal
 */
export { injectUpdateMainThread, updateMainThread };
