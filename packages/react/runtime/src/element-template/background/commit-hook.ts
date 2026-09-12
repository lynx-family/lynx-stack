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
import type { MainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';
import { takeMainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';
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
let previousCommit: typeof options[typeof COMMIT];
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

function flushElementTemplateCommitChanges(mainThreadRefInitValuePatch: MainThreadRefInitValuePatch): void {
  const hasNativeOps = globalCommitContext.ops.length > 0;
  const hasDelayedRunOnMainThread = delayedRunOnMainThreadData.length > 0;
  const hasMainThreadRefInitValuePatch = mainThreadRefInitValuePatch.length > 0;
  const hasUpdatePayload = hasNativeOps
    || !isEmptyObject(globalCommitContext.flushOptions)
    || hasDelayedRunOnMainThread
    || hasMainThreadRefInitValuePatch;
  const removedSubtreesAwaitingTeardown = hasNativeOps ? takeRemovedSubtreesForPostDispatchTeardown() : [];
  if (hasUpdatePayload) {
    markTimingLegacy('updateDiffVdomEnd');
    markTiming('diffVdomEnd');

    /* v8 ignore next */
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
    /* v8 ignore next */
    if (__PROFILE__) {
      profileEnd();
    }

    if (!hasNativeOps && !hasDelayedRunOnMainThread) {
      globalCommitContext.flushOptions.emptyPatch = true;
    }

    const delayedRunOnMainThreadPayload = hasDelayedRunOnMainThread
      ? takeDelayedRunOnMainThreadData()
      : undefined;

    let updateEvent: ReturnType<typeof createElementTemplateUpdateEvent>;
    try {
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate BTS -> MTS update:\n'
            + JSON.stringify(
              {
                ops: formatElementTemplateUpdateCommands(globalCommitContext.ops),
                flushOptions: globalCommitContext.flushOptions,
                flowIds: globalCommitContext.flowIds,
                delayedRunOnMainThreadDataCount: delayedRunOnMainThreadPayload?.length,
                mainThreadRefInitValuePatchCount: mainThreadRefInitValuePatch.length,
              },
              null,
              2,
            ),
        );
      }

      updateEvent = createElementTemplateUpdateEvent({
        ops: globalCommitContext.ops,
        flushOptions: globalCommitContext.flushOptions,
        reloadVersion: getReloadVersion(),
        flowIds: globalCommitContext.flowIds,
        delayedRunOnMainThreadData: delayedRunOnMainThreadPayload,
        mainThreadRefInitValuePatch: hasMainThreadRefInitValuePatch
          ? mainThreadRefInitValuePatch
          : undefined,
      });
    } catch (error) {
      if (delayedRunOnMainThreadPayload) {
        dropFunctionCallReturnIds(delayedRunOnMainThreadPayload.map(data => data.resolveId));
      }
      clearPendingRefs();
      resetGlobalCommitContext();
      scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);
      throw error;
    }

    lynx.getCoreContext().dispatchEvent(updateEvent);
  }
  // When native ops exist, patch first so a newly attached ref observes the
  // committed native state. Ref-only commits still flush through this path.
  flushPendingRefs();
  resetGlobalCommitContext();
  // Match Snapshot's cleanup boundary: start the delayed teardown only
  // after the bridge dispatch, so background JS objects are not torn down
  // before main-thread detach observes the same commit.
  scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);
}

export function installElementTemplateCommitHook(): void {
  if (installed) {
    return;
  }
  installed = true;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  previousCommit = options[COMMIT];

  hook(options, COMMIT, (originalCommit, vnode, commitQueue) => {
    if (__BACKGROUND__) {
      clearElementTemplateRenderScope();
    }

    if (__BACKGROUND__ && !hasHydrated && hasPendingRefs()) {
      // User effects can run before ET hydrate arrives, so ordinary refs must be
      // attached on the background commit even though native UI ops are delayed.
      flushPendingRefs();
    } else if (__BACKGROUND__ && hasHydrated) {
      const mainThreadRefInitValuePatch = takeMainThreadRefInitValuePatch();
      if (
        globalCommitContext.ops.length > 0
        || !isEmptyObject(globalCommitContext.flushOptions)
        || hasPendingRefs()
        || delayedRunOnMainThreadData.length > 0
        || mainThreadRefInitValuePatch.length > 0
      ) {
        flushElementTemplateCommitChanges(mainThreadRefInitValuePatch);
      }
    }

    originalCommit?.(vnode, commitQueue);
  });
}

/**
 * Restores the commit option replaced by
 * {@link installElementTemplateCommitHook} so tests can clean up the global
 * Preact `options` object. Assumes the matching install was the most recent
 * commit-option replacement; the snapshot and ElementTemplate runtimes are
 * separate entrypoints and never install their commit hooks in the same
 * context.
 */
export function uninstallElementTemplateCommitHookForTesting(): void {
  if (!installed) {
    return;
  }
  installed = false;
  if (previousCommit) {
    options[COMMIT] = previousCommit;
    previousCommit = undefined;
  } else {
    delete options[COMMIT];
  }
}
