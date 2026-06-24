// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import {
  globalCommitContext,
  resetGlobalCommitContext,
  takeRemovedSubtreesForPostDispatchTeardown,
} from './commit-context.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { clearElementTemplateRenderScope, resetElementTemplateRenderScope } from './render-scope.js';
import { globalPipelineOptions, markTiming, markTimingLegacy, setPipeline } from '../../core/performance.js';
import { getReloadVersion } from '../../core/reload-version.js';
import {
  delayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../core/thread-function-call/main-thread.js';
import { dropFunctionCallReturnIds } from '../../core/thread-function-call/return-value.js';
import { COMMIT } from '../../shared/render-constants.js';
import { hook, isEmptyObject } from '../../utils.js';
import { formatElementTemplateUpdateCommands } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { clearPendingRefs, flushPendingRefs, hasPendingRefs } from '../prop-adapters/ref.js';
import { createElementTemplateUpdateEvent } from '../protocol/update-event.js';

let installed = false;
let hasHydrated = false;
const scheduledRemovedSubtreeCleanupTimers = /*#__PURE__*/ new Set<ReturnType<typeof setTimeout>>();

export function markElementTemplateHydrated(): void {
  hasHydrated = true;
}

export function isElementTemplateHydrated(): boolean {
  return hasHydrated;
}

export function resetElementTemplateCommitState(): void {
  hasHydrated = false;
  resetElementTemplateRenderScope();
  resetGlobalCommitContext();
}

export function scheduleElementTemplateRemovedSubtreeCleanup(
  removedSubtreesAwaitingTeardown: BackgroundElementTemplateInstance[],
): void {
  if (removedSubtreesAwaitingTeardown.length === 0) {
    return;
  }
  const timer = setTimeout(() => {
    scheduledRemovedSubtreeCleanupTimers.delete(timer);
    for (const root of removedSubtreesAwaitingTeardown) {
      root.releaseDetachedSubtreeFromManager();
    }
  }, 10000);
  scheduledRemovedSubtreeCleanupTimers.add(timer);
}

export function cancelElementTemplateRemovedSubtreeCleanup(): void {
  for (const timer of scheduledRemovedSubtreeCleanupTimers) {
    clearTimeout(timer);
  }
  scheduledRemovedSubtreeCleanupTimers.clear();
}

function flushElementTemplateCommitChanges(): void {
  const hasNativeOps = globalCommitContext.ops.length > 0;
  const hasDelayedRunOnMainThread = delayedRunOnMainThreadData.length > 0;
  const hasUpdatePayload = hasNativeOps
    || !isEmptyObject(globalCommitContext.flushOptions)
    || hasDelayedRunOnMainThread;
  const removedSubtreesAwaitingTeardown = hasNativeOps ? takeRemovedSubtreesForPostDispatchTeardown() : [];
  let didFlushRefs = false;
  let didDispatchUpdatePayload = false;
  let delayedRunOnMainThreadPayload: typeof delayedRunOnMainThreadData | undefined;
  try {
    if (hasUpdatePayload) {
      markTimingLegacy('updateDiffVdomEnd');
      markTiming('diffVdomEnd');

      if (__PROFILE__) {
        profileStart('ReactLynx::commitChanges');
      }
      markTiming('packChangesStart');
      if (globalPipelineOptions) {
        globalCommitContext.flushOptions.pipelineOptions = globalPipelineOptions;
      }
      markTiming('packChangesEnd');
      if (globalPipelineOptions) {
        setPipeline(undefined);
      }
      if (__PROFILE__) {
        profileEnd();
      }

      delayedRunOnMainThreadPayload = hasDelayedRunOnMainThread
        ? takeDelayedRunOnMainThreadData()
        : undefined;

      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate BTS -> MTS update:\n'
            + JSON.stringify(
              {
                ops: formatElementTemplateUpdateCommands(globalCommitContext.ops),
                flushOptions: globalCommitContext.flushOptions,
                flowIds: globalCommitContext.flowIds,
                delayedRunOnMainThreadDataCount: delayedRunOnMainThreadPayload?.length,
              },
              null,
              2,
            ),
        );
      }

      lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent({
        ops: globalCommitContext.ops,
        flushOptions: globalCommitContext.flushOptions,
        reloadVersion: getReloadVersion(),
        flowIds: globalCommitContext.flowIds,
        delayedRunOnMainThreadData: delayedRunOnMainThreadPayload,
      }));
      didDispatchUpdatePayload = true;
    }
    // When native ops exist, patch first so a newly attached ref observes the
    // committed native state. Ref-only commits still flush through this path.
    flushPendingRefs();
    didFlushRefs = true;
  } finally {
    if (delayedRunOnMainThreadPayload && !didDispatchUpdatePayload) {
      dropFunctionCallReturnIds(delayedRunOnMainThreadPayload.map(data => data.resolveId));
    }
    if (!didFlushRefs) {
      clearPendingRefs();
    }
    resetGlobalCommitContext();
    // Match Snapshot's cleanup boundary: start the delayed teardown only
    // after the bridge dispatch attempt, so background JS objects are not
    // torn down before main-thread detach observes the same commit.
    scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);
  }
}

export function installElementTemplateCommitHook(): void {
  if (installed) {
    return;
  }
  installed = true;

  hook(options, COMMIT, (originalCommit, vnode, commitQueue) => {
    if (__BACKGROUND__) {
      clearElementTemplateRenderScope();
    }

    if (__BACKGROUND__ && !hasHydrated && hasPendingRefs()) {
      // User effects can run before ET hydrate arrives, so ordinary refs must be
      // attached on the background commit even though native UI ops are delayed.
      flushPendingRefs();
    } else if (
      __BACKGROUND__ && hasHydrated
      && (
        globalCommitContext.ops.length > 0
        || !isEmptyObject(globalCommitContext.flushOptions)
        || hasPendingRefs()
        || delayedRunOnMainThreadData.length > 0
      )
    ) {
      flushElementTemplateCommitChanges();
    }

    originalCommit?.(vnode, commitQueue);
  });
}
