// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  globalCommitContext,
  resetGlobalCommitContext,
  takeRemovedSubtreesForPostDispatchTeardown,
} from './commit-context.js';
import { dropDelayedRunOnMainThreadReturnIds, packElementTemplateCommitUpdateEvent } from './commit-event.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
  scheduleElementTemplateRemovedSubtreeCleanup,
} from './commit-hook.js';
import type { BackgroundPageRootInstance } from './instance.js';
import { resetElementTemplateMainThreadFunctionRuntime } from './main-thread-function.js';
import { hydratePageRootIntoContext } from './page-root-hydrate.js';
import { takeMainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';
import {
  PerformanceTimingFlags,
  PipelineOrigins,
  beginPipeline,
  globalPipelineOptions,
  markTiming,
  setPipeline,
} from '../../core/performance.js';
import { getReloadVersion } from '../../core/reload-version.js';
import {
  delayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../core/thread-function-call/main-thread.js';
import { printElementTemplateTreeToString } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { sendMTRefInitValueToMainThread } from '../main-thread-ref-init-value.js';
import { clearPendingEvents, flushPendingEvents } from '../prop-adapters/event.js';
import { clearDelayedRefUiOps, clearPendingRefs, flushDelayedRefUiOps } from '../prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { ElementTemplateHydrateCommitContext } from '../protocol/types.js';
import type { ElementTemplateUpdateEvent } from '../protocol/update-event.js';
import { __root } from '../runtime/page/root-instance.js';

let listener:
  | ((event: { data: ElementTemplateHydrateCommitContext }) => void)
  | undefined;

export function installElementTemplateHydrationListener(): void {
  resetElementTemplateHydrationListener();
  resetElementTemplateCommitState();

  listener = (event: { data: ElementTemplateHydrateCommitContext }) => {
    const { page, reloadVersion } = event.data;
    if (reloadVersion < getReloadVersion()) {
      return;
    }

    const root = __root as BackgroundPageRootInstance;

    if (__PROFILE__) {
      profileStart('ReactLynx::hydrate');
    }
    beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
    try {
      markTiming('hydrateParseSnapshotStart');
      markTiming('hydrateParseSnapshotEnd');
      markTiming('diffVdomStart');

      resetGlobalCommitContext();
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate MTS -> BTS hydrate:\n'
            + JSON.stringify({ data: page }, null, 2),
        );
        console.alog?.(
          '[ReactLynxDebug] BackgroundElementTemplate tree before hydration:\n'
            + printElementTemplateTreeToString(root),
        );
      }

      const didHydrateMatchedInstances = hydratePageRootIntoContext(page, root);
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] BackgroundElementTemplate tree after hydration:\n'
            + printElementTemplateTreeToString(root),
        );
      }

      if (__PROFILE__) {
        profileEnd();
      }
      markTiming('diffVdomEnd');

      if (didHydrateMatchedInstances) {
        markElementTemplateHydrated();
      } else {
        // Hydrate is not transactional; a later failure can happen after earlier
        // nodes were rebound. Treat the pass as failed for externally observable
        // work, so delayed refs/events are not released from an incomplete tree.
        clearPendingEvents();
        clearPendingRefs();
        clearDelayedRefUiOps();
        resetElementTemplateMainThreadFunctionRuntime();
        takeMainThreadRefInitValuePatch();
        resetGlobalCommitContext();
      }

      if (didHydrateMatchedInstances) {
        const hasDelayedRunOnMainThread = delayedRunOnMainThreadData.length > 0;
        const delayedRunOnMainThreadPayload = hasDelayedRunOnMainThread
          ? takeDelayedRunOnMainThreadData()
          : undefined;
        const pipelineOptions = globalPipelineOptions;
        if (pipelineOptions) {
          globalCommitContext.flushOptions.pipelineOptions = pipelineOptions;
        }
        const removedSubtreesAwaitingTeardown = globalCommitContext.ops.length > 0
          ? takeRemovedSubtreesForPostDispatchTeardown()
          : [];
        let hydrateUpdateEvent: ElementTemplateUpdateEvent | undefined;
        if (__PROFILE__) {
          profileStart('ReactLynx::commitChanges');
        }
        markTiming('packChangesStart');
        try {
          sendMTRefInitValueToMainThread();
          hydrateUpdateEvent = packElementTemplateCommitUpdateEvent({
            alogHeader: '[ReactLynxDebug] ElementTemplate hydrate update commands:',
            isHydration: true,
            delayedRunOnMainThreadData: delayedRunOnMainThreadPayload,
          });
        } catch (error) {
          dropDelayedRunOnMainThreadReturnIds(delayedRunOnMainThreadPayload);
          // Do not expose refs or replay delayed selector ops if the hydrate
          // patch failed to serialize; selectors may still point at stale
          // pre-hydration ids in that case.
          clearPendingEvents();
          clearPendingRefs();
          clearDelayedRefUiOps();
          lynx.reportError(error as Error);
        }
        markTiming('packChangesEnd');
        if (pipelineOptions) {
          setPipeline(undefined);
        }
        if (__PROFILE__) {
          profileEnd();
        }
        resetGlobalCommitContext();
        scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);

        if (!hydrateUpdateEvent) {
          return;
        }

        lynx.getCoreContext().dispatchEvent(hydrateUpdateEvent);
        flushPendingEvents();
        // Ordinary refs attach on Preact commit boundaries; hydration only releases
        // delayed selector ops after ids have been rebound to stable native handles.
        flushDelayedRefUiOps();
      }
    } finally {
      setPipeline(undefined);
    }
  };

  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, listener);
}

export function resetElementTemplateHydrationListener(): void {
  if (listener) {
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, listener);
  }
  listener = undefined;
}
