// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { updateMainThreadCallableCtxChanges } from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadCallableCtxPatch } from '@lynx-js/react/worklet-runtime/bindings';

import { takeCallableCtxUpdatePatch, takeCallableReleasePatch } from './callablePool.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';

function updateMTCallableCtx({ data }: { data: string }): void {
  const patch = JSON.parse(data) as MainThreadCallableCtxPatch;
  updateMainThreadCallableCtxChanges(patch);
}

export function injectUpdateMTCallableCtx(): void {
  Object.assign(globalThis, { [LifecycleConstant.updateMTCallableCtx]: updateMTCallableCtx });
}

function sendPatch(patch: MainThreadCallableCtxPatch): void {
  if (patch.length === 0) {
    return;
  }

  const data = JSON.stringify(patch);
  lynx.getNativeApp().callLepusMethod(LifecycleConstant.updateMTCallableCtx, { data });
}

/**
 * Flush staged callable ctx updates. Must be called before the commit's patch
 * update so main-thread tasks of the same commit observe the latest ctxs.
 */
export function sendMTCallableCtxToMainThread(): void {
  sendPatch(takeCallableCtxUpdatePatch());
}

/**
 * Flush staged callable releases. Must be called after the commit's patch
 * update: main-thread tasks scheduled by the unmounting commit (e.g. stopping
 * an animation that samples a final frame) may still call the callable.
 */
export function sendMTCallableReleasesToMainThread(): void {
  sendPatch(takeCallableReleasePatch());
}
