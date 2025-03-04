// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { WorkletExecIdMap } from './execMap.js';
import { enableRunOnBackground } from './functionality.js';
import type { RunOnBackgroundData } from './runOnBackground.js';

interface LynxWorkletJsImpl {
  _workletExecIdMap?: WorkletExecIdMap;
  _workletJsFnLastId: number;
  _workletRefLastId: number;
  _workletRefInitValueSet: Set<number>;
  _workletRefInitValuePatch: [number, unknown][];
}

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

  lynx.lynxWorkletJsImpl = {
    _workletJsFnLastId: 0,
    _workletRefLastId: 0,
    _workletRefInitValueSet: new Set<number>(),
    _workletRefInitValuePatch: [],
  };

  if (enableRunOnBackground()) {
    lynx.lynxWorkletJsImpl._workletExecIdMap = new WorkletExecIdMap();
    lynx.getCoreContext().addEventListener(WorkletEvents.runOnBackground, runJSFunction);
    lynx.getCoreContext().addEventListener(WorkletEvents.releaseBackgroundWorkletCtx, removeJsWorklets);
  }

  return true;
}

export function destroyWorklet(): void {
  if (!lynx.lynxWorkletJsImpl) {
    return;
  }

  lynx.lynxWorkletJsImpl = undefined;

  if (enableRunOnBackground()) {
    lynx.getCoreContext?.().removeEventListener(WorkletEvents.runOnBackground, runJSFunction);
    lynx.getCoreContext?.().removeEventListener(WorkletEvents.releaseBackgroundWorkletCtx, removeJsWorklets);
  }
}

export function lynxWorkletJsImpl(shouldInit: boolean = true): LynxWorkletJsImpl | undefined {
  if (lynx.lynxWorkletJsImpl || (shouldInit && initWorklet())) {
    return lynx.lynxWorkletJsImpl;
  }
  return undefined;
}
