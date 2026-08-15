// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { updateMainThreadCallableCtxChanges } from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadCallableCtxPatch } from '@lynx-js/react/worklet-runtime/bindings';

import { takeCallableCtxPatch } from './callablePool.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';

function updateMTCallableCtx({ data }: { data: string }): void {
  const patch = JSON.parse(data) as MainThreadCallableCtxPatch;
  updateMainThreadCallableCtxChanges(patch);
}

export function injectUpdateMTCallableCtx(): void {
  Object.assign(globalThis, { [LifecycleConstant.updateMTCallableCtx]: updateMTCallableCtx });
}

export function sendMTCallableCtxToMainThread(): void {
  const patch = takeCallableCtxPatch();
  if (patch.length === 0) {
    return;
  }

  const data = JSON.stringify(patch);
  lynx.getNativeApp().callLepusMethod(LifecycleConstant.updateMTCallableCtx, { data });
}
