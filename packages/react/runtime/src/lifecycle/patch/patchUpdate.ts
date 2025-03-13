// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';
import type { Component } from 'preact/compat';

import { clearDelayedWorklets, updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';

import { takeGlobalSnapshotPatch } from './snapshotPatch.js';
import type { SnapshotPatch } from './snapshotPatch.js';
import { snapshotPatchApply } from './snapshotPatchApply.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';
import { __pendingListUpdates } from '../../list.js';
import {
  PerformanceTimingKeys,
  globalPipelineOptions,
  markTiming,
  markTimingLegacy,
  setPipeline,
} from '../../lynx/performance.js';
import { CATCH_ERROR, COMMIT, RENDER_CALLBACKS, VNODE } from '../../renderToOpcodes/constants.js';
import { takeGlobalRefPatchMap, updateBackgroundRefs } from '../../snapshot/ref.js';
import { __page, backgroundSnapshotInstanceManager } from '../../snapshot.js';
import { isEmptyObject } from '../../utils.js';
import { takeWorkletRefInitValuePatch } from '../../worklet/workletRefPool.js';
import { runDelayedUnmounts, takeDelayedUnmounts } from '../delayUnmount.js';
import { getReloadVersion } from '../pass.js';

let globalFlushOptions: FlushOptions = {};

const globalCommitTaskMap: Map<number, () => void> = /*@__PURE__*/ new Map();
let nextCommitTaskId = 1;

let globalBackgroundSnapshotInstancesToRemove: number[] = [];

interface Patch {
  snapshotPatch?: SnapshotPatch;
  workletRefInitValuePatch?: [id: number, value: unknown][];
  flushOptions?: FlushOptions;
}

interface PatchOptions {
  commitTaskId: number;
  pipelineOptions?: PipelineOptions;
  reloadVersion?: number;
  isHydration?: boolean;
}

function injectUpdatePatch(): void {
  function updatePatch(
    { data, patchOptions }: {
      data: string;
      patchOptions: PatchOptions;
    },
  ): void {
    if ((patchOptions.reloadVersion ?? 0) < getReloadVersion()) {
      return;
    }

    setPipeline(patchOptions.pipelineOptions);
    markTiming(PerformanceTimingKeys.parse_changes_start);
    let { snapshotPatch, workletRefInitValuePatch, flushOptions } = JSON.parse(data) as Patch;
    markTiming(PerformanceTimingKeys.parse_changes_end);

    markTiming(PerformanceTimingKeys.patch_changes_start);
    updateWorkletRefInitValueChanges(workletRefInitValuePatch);
    __pendingListUpdates.clear();
    if (snapshotPatch) {
      snapshotPatchApply(snapshotPatch);
    }
    __pendingListUpdates.flush();
    // console.debug('********** Lepus updatePatch:');
    // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);

    commitMainThreadPatchUpdate(patchOptions.commitTaskId);
    if (patchOptions.isHydration) {
      clearDelayedWorklets();
    }
    markTiming(PerformanceTimingKeys.patch_changes_end);
    flushOptions ||= {};
    if (patchOptions.pipelineOptions) {
      flushOptions.pipelineOptions = patchOptions.pipelineOptions;
    }
    // TODO: triggerDataUpdated?
    __FlushElementTree(__page, flushOptions);
  }

  Object.assign(globalThis, { [LifecycleConstant.patchUpdate]: updatePatch });
}

function replaceCommitHook(): void {
  const oldCommit = options[COMMIT];
  options[COMMIT] = async (vnode: VNode, commitQueue: any[]) => {
    if (__LEPUS__) {
      // for testing only
      commitQueue.length = 0;
      return;
    }

    markTimingLegacy(PerformanceTimingKeys.update_diff_vdom_end);
    markTiming(PerformanceTimingKeys.diff_vdom_end);
    markTiming(PerformanceTimingKeys.pack_changes_start);
    if (__PROFILE__) {
      console.profile('commitChanges');
    }
    const renderCallbacks = commitQueue.map(component => {
      const ret = {
        component,
        [RENDER_CALLBACKS]: component[RENDER_CALLBACKS],
        [VNODE]: component[VNODE],
      };
      component[RENDER_CALLBACKS] = [];
      return ret;
    });
    commitQueue.length = 0;
    const delayedUnmounts = takeDelayedUnmounts();

    const backgroundSnapshotInstancesToRemove = globalBackgroundSnapshotInstancesToRemove;
    globalBackgroundSnapshotInstancesToRemove = [];

    const commitTaskId = genCommitTaskId();
    globalCommitTaskMap.set(commitTaskId, () => {
      updateBackgroundRefs(commitTaskId);
      runDelayedUnmounts(delayedUnmounts);
      oldCommit?.(vnode, renderCallbacks);
      renderCallbacks.some(wrapper => {
        try {
          wrapper[RENDER_CALLBACKS].some((cb: (this: Component) => void) => {
            cb.call(wrapper.component);
          });
        } catch (e) {
          options[CATCH_ERROR](e, wrapper[VNODE]);
        }
      });
      if (backgroundSnapshotInstancesToRemove.length) {
        setTimeout(() => {
          backgroundSnapshotInstancesToRemove.forEach(id => {
            backgroundSnapshotInstanceManager.values.delete(id);
          });
        }, 10000);
      }
    });

    const snapshotPatch = takeGlobalSnapshotPatch();
    const flushOptions = globalFlushOptions;
    const workletRefInitValuePatch = takeWorkletRefInitValuePatch();
    globalFlushOptions = {};
    if (!snapshotPatch && workletRefInitValuePatch.length === 0) {
      // before hydration, skip patch
      if (__PROFILE__) {
        console.profileEnd();
      }
      return;
    }

    const patch: Patch = {};
    // TODO: check all fields in `flushOptions` from runtime3
    if (snapshotPatch?.length) {
      patch.snapshotPatch = snapshotPatch;
    }
    if (!isEmptyObject(flushOptions)) {
      patch.flushOptions = flushOptions;
    }
    if (workletRefInitValuePatch.length) {
      patch.workletRefInitValuePatch = workletRefInitValuePatch;
    }
    await commitPatchUpdate(patch, { commitTaskId });

    const commitTask = globalCommitTaskMap.get(commitTaskId);
    if (commitTask) {
      commitTask();
      globalCommitTaskMap.delete(commitTaskId);
    }
  };
}

function commitPatchUpdate(data: Patch, patchOptions: PatchOptions): Promise<void> {
  return new Promise(resolve => {
    // console.debug('********** JS update:');
    // printSnapshotInstance(
    //   (backgroundSnapshotInstanceManager.values.get(1) || backgroundSnapshotInstanceManager.values.get(-1))!,
    // );
    // console.debug('commitPatchUpdate: ', JSON.stringify(data));
    const obj: {
      data: string;
      patchOptions: PatchOptions;
    } = {
      data: JSON.stringify(data),
      patchOptions: {
        ...patchOptions,
        reloadVersion: getReloadVersion(),
      },
    };
    markTiming(PerformanceTimingKeys.pack_changes_end);
    if (globalPipelineOptions) {
      obj.patchOptions.pipelineOptions = globalPipelineOptions;
      setPipeline(undefined);
    }
    if (__PROFILE__) {
      console.profileEnd();
    }
    lynx.getNativeApp().callLepusMethod(LifecycleConstant.patchUpdate, obj, resolve);
  });
}

function commitMainThreadPatchUpdate(commitTaskId?: number): void {
  const refPatch = takeGlobalRefPatchMap();
  if (!isEmptyObject(refPatch)) {
    __OnLifecycleEvent([LifecycleConstant.ref, { commitTaskId, refPatch: JSON.stringify(refPatch) }]);
  }
}

function genCommitTaskId(): number {
  return nextCommitTaskId++;
}

function replaceRequestAnimationFrame(): void {
  // to make afterPaintEffects run faster
  const resolvedPromise = Promise.resolve();
  options.requestAnimationFrame = (cb: () => void) => {
    resolvedPromise.then(cb);
  };
}

/**
 * @internal
 */
export {
  injectUpdatePatch,
  commitPatchUpdate,
  replaceCommitHook,
  genCommitTaskId,
  commitMainThreadPatchUpdate,
  replaceRequestAnimationFrame,
  globalFlushOptions,
  globalCommitTaskMap,
  globalBackgroundSnapshotInstancesToRemove,
  nextCommitTaskId,
};
