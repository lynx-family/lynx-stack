// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  globalCommitContext,
  resetGlobalCommitContext,
  takeRemovedSubtreesForPostDispatchTeardown,
} from './commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
  scheduleElementTemplateRemovedSubtreeCleanup,
} from './commit-hook.js';
import { hydrateRootChildrenIntoContext } from './hydrate.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { markHydrationCompleted } from '../../core/hydration.js';
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
import { dropFunctionCallReturnIds } from '../../core/thread-function-call/return-value.js';
import { formatElementTemplateUpdateCommands, printElementTemplateTreeToString } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { clearPendingEvents, flushPendingEvents } from '../prop-adapters/event.js';
import { clearDelayedRefUiOps, clearPendingRefs, flushDelayedRefUiOps } from '../prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { ElementTemplateHydrateCommitContext } from '../protocol/types.js';
import { createElementTemplateUpdateEvent } from '../protocol/update-event.js';
import { __root } from '../runtime/page/root-instance.js';
import { resetElementTemplateMainThreadFunctionRuntime } from '../runtime/template/main-thread-function.js';

let listener:
  | ((event: { data: ElementTemplateHydrateCommitContext }) => void)
  | undefined;

export function installElementTemplateHydrationListener(): void {
  resetElementTemplateHydrationListener();
  resetElementTemplateCommitState();

  listener = (event: { data: ElementTemplateHydrateCommitContext }) => {
    const { instances, reloadVersion } = event.data;
    if (reloadVersion < getReloadVersion()) {
      return;
    }

    const root = __root as BackgroundElementTemplateInstance;

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
            + JSON.stringify({ data: instances }, null, 2),
        );
        console.alog?.(
          '[ReactLynxDebug] BackgroundElementTemplate tree before hydration:\n'
            + printElementTemplateTreeToString(root),
        );
      }

      const didHydrateMatchedInstances = hydrateRootChildrenIntoContext(instances, root);
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
        if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
          console.alog?.(
            '[ReactLynxDebug] ElementTemplate hydrate update commands:\n'
              + JSON.stringify(
                {
                  ops: formatElementTemplateUpdateCommands(globalCommitContext.ops),
                  flushOptions: globalCommitContext.flushOptions,
                  flowIds: globalCommitContext.flowIds,
                  isHydration: true,
                  delayedRunOnMainThreadDataCount: delayedRunOnMainThreadPayload?.length,
                },
                null,
                2,
              ),
          );
        }
        const removedSubtreesAwaitingTeardown = globalCommitContext.ops.length > 0
          ? takeRemovedSubtreesForPostDispatchTeardown()
          : [];
        let hydrateUpdateEvent: ReturnType<typeof createElementTemplateUpdateEvent> | undefined;
        if (__PROFILE__) {
          profileStart('ReactLynx::commitChanges');
        }
        markTiming('packChangesStart');
        try {
          hydrateUpdateEvent = createElementTemplateUpdateEvent({
            ops: globalCommitContext.ops,
            flushOptions: globalCommitContext.flushOptions,
            isHydration: true,
            reloadVersion: getReloadVersion(),
            flowIds: globalCommitContext.flowIds,
            delayedRunOnMainThreadData: delayedRunOnMainThreadPayload,
          });
        } catch (error) {
          if (delayedRunOnMainThreadPayload) {
            dropFunctionCallReturnIds(delayedRunOnMainThreadPayload.map(data => data.resolveId));
          }
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
        // The hydration update has been dispatched to the main thread — resolve
        // `root.hydrate()` on this thread.
        markHydrationCompleted();
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
