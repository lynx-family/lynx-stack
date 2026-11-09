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
import type { BackgroundPageRootInstance } from './instance.js';
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
import { dropFunctionCallReturnIds } from '../../core/thread-function-call/return-value.js';
import { tryDebugLog, tryEndDebugProfile, tryStartDebugProfile } from '../../shared/debug-logging.js';
import { sendMTRefInitValueToMainThread } from '../main-thread-ref-init-value.js';
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
    const { page, reloadVersion } = event.data;
    if (reloadVersion < getReloadVersion()) {
      return;
    }

    const root = __root as BackgroundPageRootInstance;

    const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;
    if (shouldLog) {
      tryDebugLog(() => `[ReactLynxDebug] ET hydrate start root=${root.instanceId} reloadVersion=${reloadVersion}`);
    }
    let result = 'failed';
    let patchStreamLength = 0;
    let patchDispatched = false;
    try {
      const started = __PROFILE__ && tryStartDebugProfile('ReactLynx::hydrate');
      let didHydrateMatchedInstances: boolean;
      try {
        beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
        markTiming('hydrateParseSnapshotStart');
        markTiming('hydrateParseSnapshotEnd');
        markTiming('diffVdomStart');
        resetGlobalCommitContext();
        didHydrateMatchedInstances = hydratePageRootIntoContext(page, root);
        result = didHydrateMatchedInstances ? 'matched' : 'unmatched';
      } finally {
        tryEndDebugProfile(started);
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
        let hydrateUpdateEvent: ReturnType<typeof createElementTemplateUpdateEvent> | undefined;
        patchStreamLength = globalCommitContext.ops.length;
        const packingStarted = __PROFILE__ && tryStartDebugProfile('ReactLynx::commitChanges');
        try {
          markTiming('packChangesStart');
          try {
            sendMTRefInitValueToMainThread();
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
        } finally {
          tryEndDebugProfile(packingStarted);
        }
        resetGlobalCommitContext();
        scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);

        if (!hydrateUpdateEvent) {
          return;
        }

        lynx.getCoreContext().dispatchEvent(hydrateUpdateEvent);
        patchDispatched = true;
        flushPendingEvents();
        // Ordinary refs attach on Preact commit boundaries; hydration only releases
        // delayed selector ops after ids have been rebound to stable native handles.
        flushDelayedRefUiOps();
      }
    } finally {
      setPipeline(undefined);
      if (shouldLog) {
        tryDebugLog(() =>
          `[ReactLynxDebug] ET hydrate end root=${root.instanceId} result=${result} patchDispatched=${patchDispatched} patchStreamLength=${patchStreamLength}`
        );
      }
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
