// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Unsubscribe } from '@lynx-js/lynx-runtime';
import { bindPage } from '@lynx-js/lynx-runtime/bts';
import { onMessage } from '@lynx-js/lynx-runtime/mts';
import { updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadRefInitValuePatch } from '@lynx-js/react/worklet-runtime/bindings';

import { ElementTemplateLifecycleConstant } from './protocol/lifecycle-constant.js';
import { takeMainThreadRefInitValuePatch } from '../core/main-thread-ref-init-value.js';

let unsubscribe: Unsubscribe | undefined;

export function installElementTemplateRefInitValueListener(): void {
  resetElementTemplateRefInitValueListener();
  /* v8 ignore next */
  if (__LEPUS__) {
    unsubscribe = onMessage<string>(ElementTemplateLifecycleConstant.updateMTRefInitValue, (data) => {
      const patch = JSON.parse(data) as MainThreadRefInitValuePatch;
      if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
        console.alog?.('[ReactLynxDebug] ElementTemplate MTS updateMTRefInitValue:\n' + data);
      }
      // Ref initialization outlives UI patches and must not be filtered by reloadVersion.
      updateWorkletRefInitValueChanges(patch);
    });
  }
}

export function resetElementTemplateRefInitValueListener(): void {
  unsubscribe?.();
  unsubscribe = undefined;
}

export function sendMTRefInitValueToMainThread(): void {
  const patch = takeMainThreadRefInitValuePatch();
  if (patch.length === 0) {
    return;
  }
  const data = JSON.stringify(patch);
  if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
    console.alog?.('[ReactLynxDebug] ElementTemplate BTS -> MTS sendMTRefInitValue:\n' + data);
  }
  /* v8 ignore next */
  if (__JS__) {
    bindPage().sendMessage(ElementTemplateLifecycleConstant.updateMTRefInitValue, data);
  }
}
