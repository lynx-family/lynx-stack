// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import {
  GlobalCommitContext,
  resetGlobalCommitContext,
  takeRemovedSubtreesForCurrentCommit,
} from './commit-context.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { COMMIT } from '../../shared/render-constants.js';
import { hook } from '../../utils.js';
import { formatElementTemplateUpdateCommands } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { globalPipelineOptions, markTiming, markTimingLegacy, setPipeline } from '../lynx/performance.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';

let installed = false;
let hasHydrated = false;

export function markElementTemplateHydrated(): void {
  hasHydrated = true;
}

export function isElementTemplateHydrated(): boolean {
  return hasHydrated;
}

export function resetElementTemplateCommitState(): void {
  hasHydrated = false;
  resetGlobalCommitContext();
}

export function scheduleElementTemplateRemovedSubtreeCleanup(
  removedSubtrees: BackgroundElementTemplateInstance[],
): void {
  if (removedSubtrees.length === 0) {
    return;
  }
  setTimeout(() => {
    for (const root of removedSubtrees) {
      root.tearDown();
    }
  }, 10000);
}

export function installElementTemplateCommitHook(): void {
  if (installed) {
    return;
  }
  installed = true;

  hook(options, COMMIT, (originalCommit, vnode, commitQueue) => {
    if (__BACKGROUND__ && hasHydrated && GlobalCommitContext.ops.length > 0) {
      markTimingLegacy('updateDiffVdomEnd');
      markTiming('diffVdomEnd');

      if (__PROFILE__) {
        profileStart('ReactLynx::commitChanges');
      }
      markTiming('packChangesStart');
      if (globalPipelineOptions) {
        GlobalCommitContext.flushOptions.pipelineOptions = globalPipelineOptions;
      }
      markTiming('packChangesEnd');
      if (globalPipelineOptions) {
        setPipeline(undefined);
      }
      if (__PROFILE__) {
        profileEnd();
      }

      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate BTS -> MTS update:\n'
            + JSON.stringify(
              {
                ops: formatElementTemplateUpdateCommands(GlobalCommitContext.ops),
                flushOptions: GlobalCommitContext.flushOptions,
                flowIds: GlobalCommitContext.flowIds,
              },
              null,
              2,
            ),
        );
      }

      const removedSubtrees = takeRemovedSubtreesForCurrentCommit();
      try {
        lynx.getCoreContext().dispatchEvent({
          type: ElementTemplateLifecycleConstant.update,
          data: {
            ops: GlobalCommitContext.ops,
            flushOptions: GlobalCommitContext.flushOptions,
            flowIds: GlobalCommitContext.flowIds,
          },
        });
      } finally {
        resetGlobalCommitContext();
        // Match Snapshot's cleanup boundary: start the delayed teardown only
        // after the bridge dispatch attempt, so background JS objects are not
        // torn down before main-thread detach observes the same commit.
        scheduleElementTemplateRemovedSubtreeCleanup(removedSubtrees);
      }
    }

    originalCommit?.(vnode, commitQueue);
  });
}
