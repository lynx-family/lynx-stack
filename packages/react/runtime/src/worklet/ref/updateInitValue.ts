// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { updateWorkletRefInitValueChanges } from '@lynx-js/react/worklet-runtime/bindings';

import { takeWorkletRefInitValuePatch } from './workletRefPool.js';
import type { workletRefInitValuePatch } from './workletRefPool.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';

function updateMTRefInitValue({ data }: { data: string }): void {
  // This update ignores reloadVersion check.
  // MainThreadRefs created before reloadTemplate may still be referenced by user in some cases after reloadTemplate.
  const patch = JSON.parse(data) as workletRefInitValuePatch;
  updateWorkletRefInitValueChanges(patch);
}

export function injectUpdateMTRefInitValue(): void {
  Object.assign(globalThis, { [LifecycleConstant.updateMTRefInitValue]: updateMTRefInitValue });
}

export function sendMTRefInitValueToMainThread(): void {
  const patch = takeWorkletRefInitValuePatch();
  if (patch.length === 0) {
    return;
  }

  const data = JSON.stringify(patch);
  lynx.getNativeApp().callLepusMethod(LifecycleConstant.updateMTRefInitValue, { data });
}
