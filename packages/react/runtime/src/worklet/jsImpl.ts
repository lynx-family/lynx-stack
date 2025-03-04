// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { WorkletExecIdMap } from './execMap.js';
import { isRunOnBackgroundEnabled } from './functionality.js';
import type { RunOnBackgroundData } from './runOnBackground.js';
import { takeWorkletRefInitValuePatch } from './workletRefPool.js';

interface LynxWorkletJsImpl {
  _workletExecIdMap?: WorkletExecIdMap;
}

let impl: LynxWorkletJsImpl | undefined;

/**
 * @internal
 */
export function runJSFunction(event: RuntimeProxy.Event): void {
  const impl = lynxWorkletJsImpl();
  if (!impl || !impl._workletExecIdMap) {
    return;
  }
  const data = JSON.parse(event.data as string) as RunOnBackgroundData;
  const obj = impl._workletExecIdMap.findJsFnHandle(data.obj._execId!, data.obj._jsFnId);
  const f = obj?._fn;
  if (!f) {
    throw new Error('runOnBackground: JS function not found: ' + JSON.stringify(data.obj));
  }
  f(...data.params);
}

/**
 * @internal
 */
export function removeJsWorklets(event: RuntimeProxy.Event): void {
  const impl = lynxWorkletJsImpl();
  if (!impl?._workletExecIdMap) {
    return;
  }
  for (const id of event.data) {
    impl._workletExecIdMap.remove(id);
  }
}

function initWorklet(): boolean {
  if (lynx.getCoreContext === undefined) {
    return false;
  }

  impl = {};

  if (isRunOnBackgroundEnabled()) {
    impl._workletExecIdMap = new WorkletExecIdMap();
    lynx.getCoreContext().addEventListener(WorkletEvents.runOnBackground, runJSFunction);
    lynx.getCoreContext().addEventListener(WorkletEvents.releaseBackgroundWorkletCtx, removeJsWorklets);
  }

  return true;
}

export function destroyWorklet(): void {
  takeWorkletRefInitValuePatch();

  if (!impl) {
    return;
  }

  impl = undefined;

  if (isRunOnBackgroundEnabled()) {
    lynx.getCoreContext?.().removeEventListener(WorkletEvents.runOnBackground, runJSFunction);
    lynx.getCoreContext?.().removeEventListener(WorkletEvents.releaseBackgroundWorkletCtx, removeJsWorklets);
  }
}

export function lynxWorkletJsImpl(shouldInit: boolean = true): LynxWorkletJsImpl | undefined {
  if (impl || (shouldInit && initWorklet())) {
    return impl;
  }
  return undefined;
}
