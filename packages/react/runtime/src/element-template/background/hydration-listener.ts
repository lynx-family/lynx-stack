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
import { hydrateIntoContext } from './hydrate.js';
import { BackgroundElementTemplateInstance } from './instance.js';
import { formatElementTemplateUpdateCommands, printElementTemplateTreeToString } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { PerformanceTimingFlags, PipelineOrigins, beginPipeline, markTiming } from '../lynx/performance.js';
import { clearPendingEvents, flushPendingEvents } from '../prop-adapters/event.js';
import { clearDelayedRefUiOps, clearPendingRefs, flushDelayedRefUiOps } from '../prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { SerializedElementTemplate, SerializedEtNode } from '../protocol/types.js';
import { __root } from '../runtime/page/root-instance.js';

let listener:
  | ((event: { data: unknown }) => void)
  | undefined;

export function installElementTemplateHydrationListener(): void {
  resetElementTemplateHydrationListener();
  resetElementTemplateCommitState();

  listener = (event: { data: unknown }) => {
    const { data } = event;
    if (__PROFILE__) {
      profileStart('ReactLynx::hydrate');
    }
    beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
    markTiming('hydrateParsePayloadStart');
    const instances = data as SerializedEtNode[];
    markTiming('hydrateParsePayloadEnd');
    markTiming('diffVdomStart');

    const root = __root as BackgroundElementTemplateInstance;

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

    let after = root.firstChild;
    let didHydrateMatchedInstances = true;
    for (const before of instances) {
      if (!after) {
        break;
      }
      if (!('templateKey' in before)) {
        if (__DEV__) {
          lynx.reportError(
            new Error(`ElementTemplate hydrate does not support serialized typed root '${before.type}'.`),
          );
        }
        didHydrateMatchedInstances = false;
        break;
      }
      if (!hydrateIntoContext(before as SerializedElementTemplate, after)) {
        didHydrateMatchedInstances = false;
        break;
      }
      after = after.nextSibling;
    }
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
      resetGlobalCommitContext();
    }

    const hasHydrateUpdate = didHydrateMatchedInstances && globalCommitContext.ops.length > 0;
    let didDispatchHydrateUpdate = false;
    if (hasHydrateUpdate) {
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate hydrate update commands:\n'
            + JSON.stringify(
              {
                ops: formatElementTemplateUpdateCommands(globalCommitContext.ops),
                flushOptions: globalCommitContext.flushOptions,
                flowIds: globalCommitContext.flowIds,
              },
              null,
              2,
            ),
        );
      }
      const removedSubtreesAwaitingTeardown = takeRemovedSubtreesForPostDispatchTeardown();
      try {
        lynx.getCoreContext().dispatchEvent({
          type: ElementTemplateLifecycleConstant.update,
          data: {
            ops: globalCommitContext.ops,
            flushOptions: globalCommitContext.flushOptions,
            flowIds: globalCommitContext.flowIds,
          },
        });
        didDispatchHydrateUpdate = true;
      } finally {
        if (!didDispatchHydrateUpdate) {
          // Do not expose refs or replay delayed selector ops if the hydrate
          // patch failed to reach the main thread; selectors may still point at
          // stale pre-hydration ids in that case.
          clearPendingEvents();
          clearPendingRefs();
          clearDelayedRefUiOps();
        }
        resetGlobalCommitContext();
        scheduleElementTemplateRemovedSubtreeCleanup(removedSubtreesAwaitingTeardown);
      }
    }
    if (didHydrateMatchedInstances && (!hasHydrateUpdate || didDispatchHydrateUpdate)) {
      flushPendingEvents();
      // Ordinary refs attach on Preact commit boundaries; hydration only releases
      // delayed selector ops after ids have been rebound to stable native handles.
      flushDelayedRefUiOps();
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
