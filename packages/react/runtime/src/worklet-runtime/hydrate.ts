// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, JsFnHandle, Worklet, WorkletRef, WorkletRefImpl } from './bindings/index.js';
import { profile } from './utils/profile.js';
import { hydrateWorkletValue, isHydratedWorkletValue } from './workletRef.js';

/**
 * Hydrates a Worklet context with data from a first-screen Worklet context.
 * This process is typically used to run all delayed `runOnBackground` functions
 * and initialize `WorkletRef` values modified before hydration.
 *
 * @param ctx The target Worklet context to be hydrated.
 * @param firstScreenCtx The Worklet context from the first screen rendering,
 *                       containing the data to hydrate with.
 */
export function hydrateCtx(ctx: Worklet, firstScreenCtx: Worklet): void {
  profile('hydrateCtx', () => {
    hydrateCtxImpl(ctx, firstScreenCtx, ctx._execId!);
  });
}

function hydrateCtxImpl(
  ctx: ClosureValueType,
  firstScreenCtx: ClosureValueType,
  execId: number,
): void {
  if (
    !ctx || typeof ctx !== 'object' || !firstScreenCtx
    || typeof firstScreenCtx !== 'object'
  ) return;

  const ctxObj = ctx as Record<string, ClosureValueType>;
  const firstScreenCtxObj = firstScreenCtx as Record<string, ClosureValueType>;

  if (ctxObj['_wkltId'] && ctxObj['_wkltId'] !== firstScreenCtxObj['_wkltId']) {
    return;
  }

  // Worklet-value descriptors are atomic. In particular, a MainThreadObject's
  // `_initValue` is user data and must never be interpreted as nested worklet
  // metadata during hydration.
  if (typeof ctxObj['_wvid'] === 'number') {
    hydrateWorkletValueHandle(
      ctxObj as unknown as WorkletRefImpl<unknown>,
      firstScreenCtxObj as unknown as WorkletRefImpl<unknown>,
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-for-in-array
  for (const key in ctx) {
    if (key === '_jsFn') {
      hydrateDelayRunOnBackgroundTasks(
        ctxObj[key] as Record<string, JsFnHandle>,
        firstScreenCtxObj[key] as Record<string, JsFnHandle>,
        execId,
      );
    } else {
      const firstScreenValue = typeof firstScreenCtxObj[key] === 'function'
        ? (firstScreenCtxObj[key] as { ctxRef?: WeakRef<object> }).ctxRef?.deref() as ClosureValueType
        : firstScreenCtxObj[key];
      hydrateCtxImpl(ctxObj[key], firstScreenValue, execId);
    }
  }
}

/**
 * Hydrates a worklet value handle on the main thread.
 * This maps the positive-ID background handle to the compatible target realized
 * from the first-screen main-thread handle.
 *
 * @param handle The positive-ID background handle to hydrate.
 * @param value The realized first-screen target.
 */
function hydrateWorkletValueHandle(
  handle: WorkletRefImpl<unknown>,
  value: object,
) {
  if (!isHydratedWorkletValue(value)) {
    // The ref has not been accessed yet.
    return;
  }
  hydrateWorkletValue(handle, value as WorkletRef<unknown>);
}

/**
 * Hydrates delayed `runOnBackground` tasks.
 * This function ensures that any `runOnBackground` calls that were delayed
 * during the first-screen rendering are correctly associated with their
 * respective JavaScript function handles in the hydrated Worklet context.
 */
function hydrateDelayRunOnBackgroundTasks(
  fnObjs: Record<string, JsFnHandle>, // example: {"_jsFn1":{"_jsFnId":1}}
  firstScreenFnObjs: Record<string, JsFnHandle>, // example: {"_jsFn1":{"_isFirstScreen":true,"_delayIndices":[0]}}
  execId: number,
) {
  for (const fnName in fnObjs) {
    const fnObj = fnObjs[fnName]!;
    const firstScreenFnObj: JsFnHandle | undefined = firstScreenFnObjs[fnName];
    if (!firstScreenFnObj?._delayIndices) {
      if (firstScreenFnObj) {
        firstScreenFnObj._isFirstScreen = false;
        firstScreenFnObj._execId = execId;
        Object.assign(firstScreenFnObj, fnObj);
      }
      continue;
    }
    for (const index of firstScreenFnObj._delayIndices) {
      const details = lynxWorkletImpl!._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray[index];
      if (!details) {
        continue;
      }
      fnObj._execId = execId;
      details.jsFnHandle = fnObj;
    }
  }
}
