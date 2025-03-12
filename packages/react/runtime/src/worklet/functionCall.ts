// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';
import type { RunWorkletCtxRetData } from '@lynx-js/react/worklet-runtime/bindings';

import { destroyTasks } from './destroy.js';
import { IndexMap } from './indexMap.js';

let resolveMap: IndexMap<(value: any) => void> | undefined;

function initReturnValueListener(): void {
  const context: RuntimeProxy = __JS__ ? lynx.getCoreContext!() : lynx.getJSContext!();

  resolveMap = new IndexMap();
  context.addEventListener(WorkletEvents.FunctionCallRet, onFunctionCallRet);

  destroyTasks.push(() => {
    context.removeEventListener(WorkletEvents.FunctionCallRet, onFunctionCallRet);
    resolveMap = undefined;
  });
}

/**
 * @internal
 */
function onFunctionCall(resolve: (value: any) => void): number {
  if (!resolveMap) {
    initReturnValueListener();
  }
  return resolveMap!.add(resolve);
}

function onFunctionCallRet(event: RuntimeProxy.Event): void {
  const data = JSON.parse(event.data as string) as RunWorkletCtxRetData;
  const resolve = resolveMap!.get(data.resolveId)!;
  resolveMap!.remove(data.resolveId);
  resolve(data.returnValue);
}

export { onFunctionCall };
