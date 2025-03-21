// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';
import { options } from 'preact';
import type { Component } from 'preact/compat';

import type { SnapshotPatch } from './snapshotPatch.js';
import { takeGlobalSnapshotPatch } from './snapshotPatch.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';
import {
  PerformanceTimingKeys,
  globalPipelineOptions,
  markTiming,
  markTimingLegacy,
  setPipeline,
} from '../../lynx/performance.js';
import { CATCH_ERROR, COMMIT, RENDER_CALLBACKS, VNODE } from '../../renderToOpcodes/constants.js';
import { updateBackgroundRefs } from '../../snapshot/ref.js';
import { backgroundSnapshotInstanceManager } from '../../snapshot.js';
import { isEmptyObject } from '../../utils.js';
import { takeWorkletRefInitValuePatch } from '../../worklet/workletRefPool.js';
import { runDelayedUnmounts, takeDelayedUnmounts } from '../delayUnmount.js';
import { getReloadVersion } from '../pass.js';

let globalFlushOptions: FlushOptions = {};

const globalCommitTaskMap: Map<number, () => void> = /*@__PURE__*/ new Map();
let nextCommitTaskId = 1;

let globalBackgroundSnapshotInstancesToRemove: number[] = [];

let patchesToCommit: Patch[] = [];

interface Patch {
  id: number;
  snapshotPatch?: SnapshotPatch;
  workletRefInitValuePatch?: [id: number, value: unknown][];
}

interface PatchList {
  patchList: Patch[];
  flushOptions?: FlushOptions;
}

interface PatchOptions {
  pipelineOptions?: PipelineOptions;
  reloadVersion: number;
  isHydration?: boolean;
}

function replaceCommitHook(): void {
  // use our own `options.debounceRendering` to insert a timing flag before render
  type DebounceRendering = (f: () => void) => void;
  const injectDebounceRendering = (debounceRendering: DebounceRendering): DebounceRendering => {
    return (f: () => void) => {
      debounceRendering(() => {
        f();
        void commitToMainThread();
      });
    };
  };
  const defaultDebounceRendering = options.debounceRendering?.bind(options)
    ?? (Promise.prototype.then.bind(Promise.resolve()) as DebounceRendering);
  let _debounceRendering = injectDebounceRendering(defaultDebounceRendering);
  Object.defineProperty(options, 'debounceRendering', {
    get() {
      return _debounceRendering;
    },
    set(debounceRendering: DebounceRendering) {
      _debounceRendering = injectDebounceRendering(debounceRendering);
    },
  });

  const oldCommit = options[COMMIT];
  const commit = async (vnode: VNode, commitQueue: any[]) => {
    if (__LEPUS__) {
      // for testing only
      commitQueue.length = 0;
      return;
    }
    const renderCallbacks = commitQueue.map((component: Component<any>) => {
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
          options[CATCH_ERROR](e, wrapper[VNODE]!);
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
    const workletRefInitValuePatch = takeWorkletRefInitValuePatch();
    if (!snapshotPatch && workletRefInitValuePatch.length === 0) {
      // before hydration, skip patch
      return;
    }

    const patch: Patch = {
      id: commitTaskId,
    };
    // TODO: check all fields in `flushOptions` from runtime3
    if (snapshotPatch?.length) {
      patch.snapshotPatch = snapshotPatch;
    }
    if (workletRefInitValuePatch.length) {
      patch.workletRefInitValuePatch = workletRefInitValuePatch;
    }

    patchesToCommit.push(patch);
  };
  options[COMMIT] = commit as ((...args: Parameters<typeof commit>) => void);
}

async function commitToMainThread(): Promise<void> {
  if (patchesToCommit.length === 0) {
    return;
  }

  markTimingLegacy(PerformanceTimingKeys.update_diff_vdom_end);
  markTiming(PerformanceTimingKeys.diff_vdom_end);

  const flushOptions = globalFlushOptions;
  globalFlushOptions = {};

  const patchList: PatchList = {
    patchList: patchesToCommit,
  };
  patchesToCommit = [];

  if (!isEmptyObject(flushOptions)) {
    patchList.flushOptions = flushOptions;
  }

  await commitPatchUpdate(patchList, {});

  for (const patch of patchList.patchList) {
    const commitTask = globalCommitTaskMap.get(patch.id);
    if (commitTask) {
      commitTask();
      globalCommitTaskMap.delete(patch.id);
    }
  }
}

function commitPatchUpdate(patchList: PatchList, patchOptions: Omit<PatchOptions, 'reloadVersion'>): Promise<void> {
  return new Promise(resolve => {
    // console.debug('********** JS update:');
    // printSnapshotInstance(
    //   (backgroundSnapshotInstanceManager.values.get(1) || backgroundSnapshotInstanceManager.values.get(-1))!,
    // );
    // console.debug('commitPatchUpdate: ', JSON.stringify(patchList));
    if (__PROFILE__) {
      console.profile('commitChanges');
    }
    markTiming(PerformanceTimingKeys.pack_changes_start);
    const obj: {
      data: string;
      patchOptions: PatchOptions;
    } = {
      data: JSON.stringify(patchList),
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
    lynx.getNativeApp().callLepusMethod(LifecycleConstant.patchUpdate, obj, resolve);
    if (__PROFILE__) {
      console.profileEnd();
    }
  });
}

function genCommitTaskId(): number {
  return nextCommitTaskId++;
}

function replaceRequestAnimationFrame(): void {
  // to make afterPaintEffects run faster
  const resolvedPromise = Promise.resolve();
  options.requestAnimationFrame = (cb: () => void) => {
    void resolvedPromise.then(cb);
  };
}

/**
 * @internal
 */
export {
  commitPatchUpdate,
  commitToMainThread,
  genCommitTaskId,
  globalBackgroundSnapshotInstancesToRemove,
  globalCommitTaskMap,
  globalFlushOptions,
  nextCommitTaskId,
  replaceCommitHook,
  replaceRequestAnimationFrame,
  type PatchOptions,
  type PatchList,
};
