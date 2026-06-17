// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType } from '@lynx-js/react/worklet-runtime/bindings';
import {
  flushDelayedRunOnBackgroundFunctions,
  runRunOnMainThreadTask,
  setEomShouldFlushElementTree,
} from '@lynx-js/react/worklet-runtime/bindings';

import { markTiming, setPipeline } from '../../core/performance.js';
import { getReloadVersion } from '../../core/reload-version.js';
import { formatElementTemplateUpdateCommands } from '../debug/alog.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { ElementTemplateUpdateCommitContext } from '../protocol/types.js';
import { __page } from '../runtime/page/page.js';
import { applyElementTemplateUpdateCommands } from '../runtime/patch.js';

let listener:
  | ((event: { data: unknown }) => void)
  | undefined;

export function installElementTemplatePatchListener(): void {
  resetElementTemplatePatchListener();

  listener = (event: { data: unknown }) => {
    const { data } = event;
    const payload = JSON.parse(data as string) as ElementTemplateUpdateCommitContext;
    if (typeof payload?.reloadVersion === 'number' && payload.reloadVersion < getReloadVersion()) {
      return;
    }

    const hasOps = Array.isArray(payload?.ops) && payload.ops.length > 0;
    const flushOptions = payload?.flushOptions ?? {};
    const pipelineOptions = flushOptions.pipelineOptions;
    setPipeline(pipelineOptions);
    const flowIds = Array.isArray(payload?.flowIds) && payload.flowIds.length > 0
      ? payload.flowIds
      : undefined;
    const shouldProfilePatch = hasOps
      && !!flowIds
      && typeof lynx.performance?.profileStart === 'function'
      && typeof lynx.performance?.profileEnd === 'function';

    if (shouldProfilePatch) {
      lynx.performance.profileStart('ReactLynx::patch', {
        flowId: flowIds[0],
        flowIds,
      });
    }

    const isHydration = payload.isHydration === true;
    const delayedRunOnMainThreadData = Array.isArray(payload.delayedRunOnMainThreadData)
      ? payload.delayedRunOnMainThreadData
      : undefined;
    if (hasOps) {
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.(
          '[ReactLynxDebug] ElementTemplate main-thread patch:\n'
            + JSON.stringify(
              {
                ops: formatElementTemplateUpdateCommands(payload.ops),
                flushOptions,
                flowIds,
              },
              null,
              2,
            ),
        );
      }
      markTiming('mtsRenderStart');
      markTiming('parseChangesStart');
      markTiming('parseChangesEnd');
      markTiming('patchChangesStart');
      try {
        applyElementTemplateUpdateCommands(payload.ops, isHydration);
      } finally {
        markTiming('patchChangesEnd');
        markTiming('mtsRenderEnd');
        if (isHydration) {
          flushDelayedRunOnBackgroundFunctions();
        }
      }
    } else if (isHydration) {
      flushDelayedRunOnBackgroundFunctions();
    }
    if (delayedRunOnMainThreadData?.length) {
      setEomShouldFlushElementTree(false);
      try {
        for (const data of delayedRunOnMainThreadData) {
          try {
            runRunOnMainThreadTask(data.worklet, data.params as ClosureValueType[], data.resolveId);
          } catch (error) {
            lynx.reportError(error as Error);
          }
        }
      } finally {
        setEomShouldFlushElementTree(true);
      }
    }

    __FlushElementTree(__page, flushOptions);

    if (shouldProfilePatch) {
      lynx.performance.profileEnd();
    }
  };

  lynx.getJSContext().addEventListener(
    ElementTemplateLifecycleConstant.update,
    listener,
  );
}

export function resetElementTemplatePatchListener(): void {
  if (listener) {
    lynx.getJSContext().removeEventListener(
      ElementTemplateLifecycleConstant.update,
      listener,
    );
  }
  listener = undefined;
}
