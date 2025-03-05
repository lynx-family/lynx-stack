// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { JsFnHandle, Worklet } from '@lynx-js/react/worklet-runtime/bindings';
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { destroyTasks } from './destroy.js';
import { WorkletExecIdMap } from './execMap.js';
import { isRunOnBackgroundEnabled } from './functionality.js';

/**
 * @internal
 */
interface RunOnBackgroundData {
  obj: JsFnHandle;
  params: unknown[];
}

let execIdMap: WorkletExecIdMap | undefined;

function init() {
  'background only';
  if (execIdMap) {
    return;
  }

  execIdMap = new WorkletExecIdMap();
  lynx.getCoreContext().addEventListener(WorkletEvents.runOnBackground, runJSFunction);
  lynx.getCoreContext().addEventListener(WorkletEvents.releaseBackgroundWorkletCtx, releaseBackgroundWorkletCtx);

  destroyTasks.push(() => {
    lynx.getCoreContext().removeEventListener(WorkletEvents.runOnBackground, runJSFunction);
    lynx.getCoreContext().removeEventListener(WorkletEvents.releaseBackgroundWorkletCtx, releaseBackgroundWorkletCtx);
    execIdMap = undefined;
  });
}

/**
 * @internal
 */
function runJSFunction(event: RuntimeProxy.Event): void {
  'background only';
  const data = JSON.parse(event.data as string) as RunOnBackgroundData;
  const obj = execIdMap!.findJsFnHandle(data.obj._execId!, data.obj._jsFnId);
  const f = obj?._fn;
  if (!f) {
    throw new Error('runOnBackground: JS function not found: ' + JSON.stringify(data.obj));
  }
  f(...data.params);
}

function releaseBackgroundWorkletCtx(event: RuntimeProxy.Event): void {
  'background only';
  for (const id of event.data) {
    execIdMap!.remove(id as number);
  }
}

/**
 * @internal
 */
function registerWorkletCtx(ctx: Worklet): void {
  'background only';
  init();
  execIdMap!.add(ctx);
}

/**
 * `runOnBackground` allows triggering js functions on the js context asynchronously.
 * @param f - The js function to be called.
 * @returns A function. Calling which with the arguments to be passed to the js function to trigger it on the js context.
 * @public
 */
function runOnBackground<Fn extends (...args: any[]) => any>(f: Fn): (...args: Parameters<Fn>) => void {
  if (!isRunOnBackgroundEnabled()) {
    throw new Error('runOnBackground requires Lynx sdk version 2.16.');
  }
  if (__JS__) {
    throw new Error('runOnBackground can only be used on the main thread.');
  }
  const obj = f as any as JsFnHandle;
  if (obj._error) {
    throw new Error(obj._error);
  }
  return (...params: any[]): void => {
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.runOnBackground,
      data: JSON.stringify({
        obj: {
          _jsFnId: obj._jsFnId,
          _execId: obj._execId!,
        },
        params,
      } as RunOnBackgroundData),
    });
  };
}

export { runJSFunction, registerWorkletCtx, runOnBackground };
