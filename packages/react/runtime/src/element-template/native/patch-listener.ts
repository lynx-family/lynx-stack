// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { flushElementTree, onMessage } from '@lynx-js/lynx-runtime/mts';
import type { Unsubscribe } from '@lynx-js/lynx-runtime/mts';
import type { ClosureValueType } from '@lynx-js/react/worklet-runtime/bindings';
import {
  clearFirstScreenMainThreadRefs,
  flushDelayedRunOnBackgroundFunctions,
  runRunOnMainThreadTask,
  setEomShouldFlushElementTree,
} from '@lynx-js/react/worklet-runtime/bindings';

import { markTiming, setPipeline } from '../../core/performance.js';
import { getReloadVersion } from '../../core/reload-version.js';
import { formatElementTemplateUpdateCommands } from '../debug/alog.js';
import { ElementTemplateLifecycleConstant } from '../protocol/lifecycle-constant.js';
import type { ElementTemplateUpdateCommitContext } from '../protocol/types.js';
import type { ElementTemplateUpdateEventData } from '../protocol/update-event.js';
import { applyElementTemplateUpdateCommands } from '../runtime/patch.js';
import { applyPendingMainThreadRefAttachments } from '../runtime/template/main-thread-dynamic-attr-state.js';

let unsubscribe: Unsubscribe | undefined;

export function installElementTemplatePatchListener(): void {
  resetElementTemplatePatchListener();

  unsubscribe = onMessage<ElementTemplateUpdateEventData>(ElementTemplateLifecycleConstant.update, (data) => {
    const { patchOptions } = data;
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
    try {
      markTiming('mtsRenderStart');
      markTiming('parseChangesStart');

      const payload = JSON.parse(data.payload) as ElementTemplateUpdateCommitContext;
      markTiming('parseChangesEnd');

      if (
        typeof patchOptions.reloadVersion === 'number'
        && patchOptions.reloadVersion < getReloadVersion()
      ) {
        markTiming('mtsRenderEnd');
        if (shouldProfilePatch) {
          lynx.performance.profileEnd();
        }
        return;
      }

      const hasOps = payload.ops.length > 0;
      const flushOptions = payload.flushOptions;
      const isHydration = payload.isHydration === true;
      const delayedRunOnMainThreadData = payload.delayedRunOnMainThreadData;
      try {
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
          }
        } else {
          markTiming('mtsRenderEnd');
        }
        applyPendingMainThreadRefAttachments(isHydration);
      } finally {
        if (isHydration) {
          flushDelayedRunOnBackgroundFunctions();
          clearFirstScreenMainThreadRefs();
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

      flushElementTree(flushOptions);

      if (shouldProfilePatch) {
        lynx.performance.profileEnd();
      }
    } finally {
      setPipeline(undefined);
    }
  });
}

export function resetElementTemplatePatchListener(): void {
  unsubscribe?.();
  unsubscribe = undefined;
}
