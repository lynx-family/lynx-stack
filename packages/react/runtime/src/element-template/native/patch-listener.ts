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
import type { ElementTemplateUpdateEvent } from '../protocol/update-event.js';
import { __page } from '../runtime/page/page.js';
import { applyElementTemplateUpdateCommands } from '../runtime/patch.js';

let listener:
  | ((event: Pick<ElementTemplateUpdateEvent, 'data'>) => void)
  | undefined;

export function installElementTemplatePatchListener(): void {
  resetElementTemplatePatchListener();

  listener = (event: Pick<ElementTemplateUpdateEvent, 'data'>) => {
    const { patchOptions } = event.data;
    if (
      typeof patchOptions.reloadVersion === 'number'
      && patchOptions.reloadVersion < getReloadVersion()
    ) {
      return;
    }

    const { flowIds, pipelineOptions } = patchOptions;
    const shouldProfilePatch = !!flowIds
      && typeof lynx.performance?.profileStart === 'function'
      && typeof lynx.performance?.profileEnd === 'function';
    if (shouldProfilePatch) {
      lynx.performance.profileStart('ReactLynx::patch', {
        flowId: flowIds[0],
        flowIds,
      });
    }
    setPipeline(pipelineOptions);
    markTiming('mtsRenderStart');
    markTiming('parseChangesStart');

    const payload = JSON.parse(event.data.payload) as ElementTemplateUpdateCommitContext;
    markTiming('parseChangesEnd');

    const hasOps = payload.ops.length > 0;
    const flushOptions = payload.flushOptions;
    const isHydration = payload.isHydration === true;
    const delayedRunOnMainThreadData = payload.delayedRunOnMainThreadData;
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
    } else {
      markTiming('mtsRenderEnd');
      if (isHydration) {
        flushDelayedRunOnBackgroundFunctions();
      }
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
