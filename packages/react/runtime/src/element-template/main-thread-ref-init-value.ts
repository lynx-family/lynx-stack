// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadRefInitValuePatch } from '@lynx-js/react/worklet-runtime/bindings';

import { takeMainThreadRefInitValuePatch } from '../core/main-thread-ref-init-value.js';
import { ElementTemplateLifecycleConstant } from './protocol/lifecycle-constant.js';

let listener: ((event: RuntimeProxy.Event) => void) | undefined;

export function installElementTemplateRefInitValueListener(): void {
  resetElementTemplateRefInitValueListener();
  listener = (event) => {
    const data = event.data as string;
    const patch = JSON.parse(data) as MainThreadRefInitValuePatch;
    if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
      console.alog?.('[ReactLynxDebug] ElementTemplate MTS updateMTRefInitValue:\n' + data);
    }
    // Ref initialization outlives UI patches and must not be filtered by reloadVersion.
    updateWorkletRefInitValueChanges(patch);
  };
  lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.updateMTRefInitValue, listener);
}

export function resetElementTemplateRefInitValueListener(): void {
  if (listener) {
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.updateMTRefInitValue, listener);
  }
  listener = undefined;
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
  lynx.getCoreContext().dispatchEvent({ type: ElementTemplateLifecycleConstant.updateMTRefInitValue, data });
}
