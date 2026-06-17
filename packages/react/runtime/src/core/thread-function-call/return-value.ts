// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IndexMap } from '../../shared/index-map.js';
import { WorkletEvents } from '../../worklet-runtime/bindings/events.js';
import type { RunWorkletCtxRetData } from '../../worklet-runtime/bindings/events.js';
import { registerDestroyTask } from '../runtime-destroy.js';

let resolveMap: IndexMap<(value: any) => void> | undefined;
let cleanupReturnValueListener: (() => void) | undefined;
let unregisterReturnValueCleanup: (() => void) | undefined;

function initReturnValueListener(): void {
  const context: RuntimeProxy = __JS__ ? lynx.getCoreContext() : lynx.getJSContext();

  resolveMap = new IndexMap();
  context.addEventListener(WorkletEvents.FunctionCallRet, onFunctionCallRet);

  cleanupReturnValueListener = () => {
    context.removeEventListener(WorkletEvents.FunctionCallRet, onFunctionCallRet);
    resolveMap = undefined;
    cleanupReturnValueListener = undefined;
  };
}

/**
 * @internal
 */
export function onFunctionCall(resolve: (value: any) => void): number {
  ensureFunctionCallReturnCleanup();
  if (!resolveMap) {
    initReturnValueListener();
  }
  return resolveMap!.add(resolve);
}

function ensureFunctionCallReturnCleanup(): void {
  if (unregisterReturnValueCleanup) {
    return;
  }
  unregisterReturnValueCleanup = registerDestroyTask(() => {
    resetFunctionCallReturnListener();
  });
}

export function resetFunctionCallReturnListener(): void {
  cleanupReturnValueListener?.();
  unregisterReturnValueCleanup?.();
  unregisterReturnValueCleanup = undefined;
}

export function dropFunctionCallReturnIds(resolveIds: readonly number[]): void {
  for (const resolveId of resolveIds) {
    resolveMap!.remove(resolveId);
  }
  if (resolveMap!.size === 0) {
    resetFunctionCallReturnListener();
  }
}

function onFunctionCallRet(event: RuntimeProxy.Event): void {
  const data = JSON.parse(event.data as string) as RunWorkletCtxRetData;
  const resolve = resolveMap!.get(data.resolveId)!;
  resolveMap!.remove(data.resolveId);
  resolve(data.returnValue);
}
