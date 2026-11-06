// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { takeGlobalFlushOptions } from '../core/commit-context.js';
import { takeDelayedRunOnMainThreadData } from '../core/thread-function-call/main-thread.js';
import { COMMIT } from '../shared/render-constants.js';
import { isRendering } from './lifecycle/isRendering.js';
import { genCommitTaskId, removeCommitHookForTesting } from './lifecycle/patch/commit.js';
import type { PatchList, PatchOptions } from './lifecycle/patch/commit.js';
import {
  globalBackgroundSnapshotInstancesToRemove,
  setGlobalBackgroundSnapshotInstancesToRemove,
} from './lifecycle/patch/globalState.js';
import { takeGlobalSnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import { backgroundSnapshotInstanceManager } from './snapshot/backgroundSnapshot.js';
import { applyQueuedRefs } from './snapshot/ref.js';

/**
 * Installs the opt-in transfer commit path instead of the ordinary page hook.
 * Transport and completion ownership belong to the creating transfer context.
 * Ordinary pages neither import this module nor execute its handler.
 * @internal
 */
export function installTransferCommitHook(
  submit: (vnode: VNode, patches: PatchList, options: PatchOptions, finish: () => void) => void,
): () => void {
  // The existing bootstrap installs the page hook before the explicit opt-in.
  // Remove it rather than nesting it inside the transfer hook.
  removeCommitHookForTesting();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const previous = options[COMMIT];
  const commit: NonNullable<typeof previous> = (vnode, commitQueue) => {
    isRendering.value = false;
    const removals = globalBackgroundSnapshotInstancesToRemove;
    setGlobalBackgroundSnapshotInstancesToRemove([]);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      removals.forEach(id => backgroundSnapshotInstanceManager.values.get(id)?.tearDown());
    };
    const patch = takeGlobalSnapshotPatch();
    const flushOptions = takeGlobalFlushOptions();
    const delayed = takeDelayedRunOnMainThreadData();
    const packet: PatchList = {
      patchList: patch === undefined ? [] : [{ id: genCommitTaskId(), snapshotPatch: patch }],
      flushOptions,
    };
    if (delayed.length) packet.delayedRunOnMainThreadData = delayed;
    submit(vnode, packet, { reloadVersion: 0 }, finish);
    applyQueuedRefs();
    previous?.(vnode, commitQueue);
  };
  options[COMMIT] = commit;
  return () => {
    if (options[COMMIT] !== commit) return;
    if (previous) options[COMMIT] = previous;
    else delete options[COMMIT];
  };
}
