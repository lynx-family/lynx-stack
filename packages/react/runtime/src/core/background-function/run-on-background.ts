// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BackgroundFunctionExecMap } from './exec-map.js';
import { isSdkVersionGt } from '../../utils.js';
import { delayRunOnBackground } from '../../worklet-runtime/bindings/bindings.js';
import { WorkletEvents } from '../../worklet-runtime/bindings/events.js';
import type { RunWorkletCtxRetData } from '../../worklet-runtime/bindings/events.js';
import type { ClosureValueType, JsFnHandle, Worklet } from '../../worklet-runtime/bindings/types.js';
import { registerDestroyTask } from '../runtime-destroy.js';
import { onFunctionCall } from '../thread-function-call/return-value.js';

/**
 * @internal
 */
interface RunOnBackgroundData {
  obj: JsFnHandle;
  params: unknown[];
  resolveId: number;
}

let execIdMap: BackgroundFunctionExecMap | undefined;
let cleanupBackgroundFunctionRuntime: (() => void) | undefined;
let unregisterBackgroundFunctionCleanup: (() => void) | undefined;

function initBackgroundFunctionRuntime(): void {
  'background only';
  if (execIdMap) {
    return;
  }

  execIdMap = new BackgroundFunctionExecMap();
  const context = lynx.getCoreContext();
  context.addEventListener(WorkletEvents.runOnBackground, runBackgroundFunction);
  context.addEventListener(WorkletEvents.releaseBackgroundWorkletCtx, releaseBackgroundFunctionCtx);

  cleanupBackgroundFunctionRuntime = () => {
    context.removeEventListener(WorkletEvents.runOnBackground, runBackgroundFunction);
    context.removeEventListener(WorkletEvents.releaseBackgroundWorkletCtx, releaseBackgroundFunctionCtx);
    execIdMap = undefined;
    cleanupBackgroundFunctionRuntime = undefined;
  };
}

/**
 * @internal
 */
export function runBackgroundFunction(event: RuntimeProxy.Event): void {
  'background only';
  const data = JSON.parse(event.data as string) as RunOnBackgroundData;
  const obj = execIdMap!.findJsFnHandle(data.obj._execId!, data.obj._jsFnId!);
  const f = obj?._fn;
  if (!f) {
    throw new Error('runOnBackground: JS function not found: ' + JSON.stringify(data.obj));
  }
  const returnValue = f(...data.params);
  lynx.getCoreContext().dispatchEvent({
    type: WorkletEvents.FunctionCallRet,
    data: JSON.stringify({
      resolveId: data.resolveId,
      returnValue,
    } as RunWorkletCtxRetData),
  });
}

function releaseBackgroundFunctionCtx(event: RuntimeProxy.Event): void {
  'background only';
  for (const id of event.data) {
    execIdMap!.remove(id as number);
  }
}

/**
 * @internal
 */
export function registerBackgroundFunctionCtx(ctx: Worklet): void {
  'background only';
  initBackgroundFunctionRuntime();
  ensureBackgroundFunctionCleanup();
  execIdMap!.add(ctx);
}

function ensureBackgroundFunctionCleanup(): void {
  if (unregisterBackgroundFunctionCleanup) {
    return;
  }
  unregisterBackgroundFunctionCleanup = registerDestroyTask(() => {
    resetBackgroundFunctionRuntime();
  });
}

export function resetBackgroundFunctionRuntime(): void {
  cleanupBackgroundFunctionRuntime?.();
  unregisterBackgroundFunctionCleanup?.();
  unregisterBackgroundFunctionCleanup = undefined;
}

/**
 * `runOnBackground` allows triggering js functions on the background thread asynchronously.
 * @param f - The js function to be called.
 * @returns A function. Calling which with the arguments to be passed to the js function to trigger it on the background thread. This function returns a promise that resolves to the return value of the js function.
 * @public
 */
export function runOnBackground<R, Fn extends (...args: any[]) => R>(
  f: Fn,
): (...args: Parameters<Fn>) => Promise<R> {
  if (!isSdkVersionGt(2, 15)) {
    throw new Error('runOnBackground requires Lynx sdk version 2.16.');
  }
  if (__JS__) {
    throw new Error('runOnBackground can only be used on the main thread.');
  }
  const obj = f as any as JsFnHandle;
  if (obj._error) {
    throw new Error(obj._error);
  }
  return async (...params: ClosureValueType[]): Promise<R> => {
    return new Promise((resolve) => {
      const resolveId = onFunctionCall(resolve);

      if (obj._isFirstScreen) {
        delayRunOnBackground(obj, (fnId: number, execId: number) => {
          dispatchRunBackgroundFunctionEvent(fnId, params, execId, resolveId);
        });
        return;
      }

      dispatchRunBackgroundFunctionEvent(obj._jsFnId!, params, obj._execId!, resolveId);
    });
  };
}

function dispatchRunBackgroundFunctionEvent(
  fnId: number,
  params: ClosureValueType[],
  execId: number,
  resolveId: number,
): void {
  lynx.getJSContext().dispatchEvent({
    type: WorkletEvents.runOnBackground,
    data: JSON.stringify({
      obj: {
        _jsFnId: fnId,
        _execId: execId,
      },
      params,
      resolveId,
    } as RunOnBackgroundData),
  });
}
