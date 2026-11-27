// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { JsFunctionLifecycleManager } from './lifecycle.js';
import type { JsFnHandle, Worklet } from '../bindings/types.js';

interface Details {
  task: (fnId: number, execId: number) => void;

  // This comes from the background thread, inserted here during ctx hydration.
  jsFnHandle?: JsFnHandle;
}

interface RunOnBackgroundDelayImpl {
  // Elements should keep the order being called by the user.
  delayedBackgroundFunctionArray: Array<Details | undefined>;
  epoch: number;
  hasHydrated: boolean;
  clearDelayedBackgroundFunctions(): void;
  delayRunOnBackground(fnObj: JsFnHandle, fn: (fnId: number, execId: number) => void): void;
  runDelayedBackgroundFunctions(): void;
  flushBoundDelayedBackgroundFunctions(): void;
  discardBoundDelayedBackgroundFunctions(): void;
}

function isStaleHydratedEpoch(
  handle: JsFnHandle,
  currentEpoch?: number,
): boolean {
  return handle._hydratedEpoch !== undefined
    && handle._hydratedEpoch !== (currentEpoch ?? lynxWorkletImpl._runOnBackgroundDelayImpl.epoch);
}

function initRunOnBackgroundDelay(): RunOnBackgroundDelayImpl {
  const pendingHandles = new Set<JsFnHandle>();
  function clearPendingDelayIndices(): void {
    for (const handle of pendingHandles) {
      delete handle._delayIndices;
    }
    pendingHandles.clear();
  }
  function drainBoundDelayedBackgroundFunctions(runTasks: boolean): void {
    const queue = instance.delayedBackgroundFunctionArray;
    let hasPending = false;
    let firstError: unknown;
    let hasError = false;
    // Pending handles keep indices into the queue, so bound calls are cleared in place.
    for (let index = 0; index < queue.length; index++) {
      const details = queue[index];
      if (!details) continue;
      if (!details.jsFnHandle) {
        hasPending = true;
        continue;
      }
      queue[index] = undefined;
      if (!runTasks) continue;
      try {
        details.task(details.jsFnHandle._jsFnId!, details.jsFnHandle._execId!);
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    }
    if (!hasPending) {
      instance.delayedBackgroundFunctionArray = [];
      clearPendingDelayIndices();
    }
    if (hasError) {
      throw firstError;
    }
  }
  const instance: RunOnBackgroundDelayImpl = {
    delayedBackgroundFunctionArray: [],
    epoch: 0,
    hasHydrated: false,
    clearDelayedBackgroundFunctions(): void {
      instance.epoch++;
      instance.hasHydrated = false;
      clearPendingDelayIndices();
      // PrimJS can keep truncated array storage alive; drop the consumed queue so
      // its tasks and hydrated handles stop retaining their background executions.
      instance.delayedBackgroundFunctionArray = [];
    },
    delayRunOnBackground(fnObj: JsFnHandle, task: (fnId: number, execId: number) => void): void {
      if (instance.hasHydrated) {
        return;
      }
      pendingHandles.add(fnObj);
      instance.delayedBackgroundFunctionArray.push({ task });
      const delayIndices = fnObj._delayIndices ??= [];
      delayIndices.push(instance.delayedBackgroundFunctionArray.length - 1);
    },
    runDelayedBackgroundFunctions(): void {
      const queue = instance.delayedBackgroundFunctionArray;
      instance.delayedBackgroundFunctionArray = [];
      instance.hasHydrated = true;
      clearPendingDelayIndices();
      for (const details of queue) {
        if (details?.jsFnHandle) {
          details.task(details.jsFnHandle._jsFnId!, details.jsFnHandle._execId!);
        }
      }
    },
    flushBoundDelayedBackgroundFunctions(): void {
      drainBoundDelayedBackgroundFunctions(true);
    },
    discardBoundDelayedBackgroundFunctions(): void {
      drainBoundDelayedBackgroundFunctions(false);
    },
  };
  return instance;
}

/**
 * Hydrates first-screen `JsFnHandle` placeholders and associates any queued
 * pre-hydration `runOnBackground` tasks with their hydrated handles.
 */
function hydrateJsFnHandles(
  fnObjs: Record<string, JsFnHandle>, // example: {"_jsFn1":{"_jsFnId":1}}
  firstScreenFnObjs: Record<string, JsFnHandle>, // example: {"_jsFn1":{"_isFirstScreen":true,"_delayIndices":[0]}}
  execId: number,
): void {
  const delayImpl = lynxWorkletImpl!._runOnBackgroundDelayImpl;
  const currentEpoch = delayImpl.epoch;
  for (const fnName in fnObjs) {
    const fnObj = fnObjs[fnName]!;
    fnObj._execId = execId;
    const firstScreenFnObj: JsFnHandle | undefined = firstScreenFnObjs[fnName];
    if (!firstScreenFnObj) {
      continue;
    }
    if (firstScreenFnObj._isFirstScreen || isStaleHydratedEpoch(firstScreenFnObj, currentEpoch)) {
      Object.assign(firstScreenFnObj, fnObj);
      firstScreenFnObj._isFirstScreen = false;
      firstScreenFnObj._hydratedEpoch = currentEpoch;
      lynxWorkletImpl!._jsFunctionLifecycleManager?.addRef(
        execId,
        firstScreenFnObj,
      );
    }
    const delayIndices = firstScreenFnObj._delayIndices;
    if (!delayIndices) {
      continue;
    }
    delete firstScreenFnObj._delayIndices;
    for (const index of delayIndices) {
      const details = delayImpl.delayedBackgroundFunctionArray[index];
      if (!details) {
        continue;
      }
      details.jsFnHandle = firstScreenFnObj;
    }
  }
}

/**
 * Binds and retains a captured `JsFnHandle` during worklet context transformation,
 * skipping handles from retired reload epochs and preserving prebound `_execId`s.
 */
function bindCapturedJsFnHandle(
  handle: JsFnHandle,
  rootCtx: Worklet,
): void {
  if (isStaleHydratedEpoch(handle)) {
    return;
  }
  const targetExecId = handle._execId ?? rootCtx._execId;
  if (targetExecId !== undefined) {
    handle._execId = targetExecId;
    lynxWorkletImpl._jsFunctionLifecycleManager?.addRef(
      targetExecId,
      handle,
    );
  }
}

export {
  type RunOnBackgroundDelayImpl,
  JsFunctionLifecycleManager,
  initRunOnBackgroundDelay,
  hydrateJsFnHandles,
  bindCapturedJsFnHandle,
};
