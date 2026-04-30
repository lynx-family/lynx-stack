// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { GlobalCommitContext, resetGlobalCommitContext } from './commit-context.js';
import { markElementTemplateHydrated, resetElementTemplateCommitState } from './commit-hook.js';
import { hydrateIntoContext } from './hydrate.js';
import { BackgroundElementTemplateInstance } from './instance.js';
import { formatElementTemplateUpdateCommands, printElementTemplateTreeToString } from '../debug/alog.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { PerformanceTimingFlags, PipelineOrigins, beginPipeline, markTiming } from '../lynx/performance.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { SerializedElementTemplate } from '../protocol/types.js';
import { __root } from '../runtime/page/root-instance.js';

let listener:
  | ((event: { data: unknown }) => void)
  | undefined;

export function installElementTemplateHydrationListener(): void {
  resetElementTemplateHydrationListener();

  listener = (event: { data: unknown }) => {
    const { data } = event;
    if (__PROFILE__) {
      profileStart('ReactLynx::hydrate');
    }
    beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);
    markTiming('hydrateParsePayloadStart');
    const instances = data as SerializedElementTemplate[];
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
    for (const before of instances) {
      if (!after) {
        break;
      }
      hydrateIntoContext(before, after);
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

    markElementTemplateHydrated();

    if (GlobalCommitContext.ops.length > 0) {
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate hydrate update commands:\n'
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
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.update,
        data: {
          ops: GlobalCommitContext.ops,
          flushOptions: GlobalCommitContext.flushOptions,
          flowIds: GlobalCommitContext.flowIds,
        },
      });
      resetGlobalCommitContext();
    }
  };

  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, listener);
}

export function resetElementTemplateHydrationListener(): void {
  if (listener) {
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, listener);
  }
  listener = undefined;
  resetElementTemplateCommitState();
}
