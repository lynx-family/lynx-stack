// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Element } from './api/element.js';
import type { ClosureValueType, JsFnHandle, Worklet, WorkletRefId, WorkletRefImpl } from './bindings/index.js';
import { profile } from './utils/profile.js';

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

function hydrateCtxImpl(ctx: ClosureValueType, firstScreenCtx: ClosureValueType, execId: number): void {
  if (!ctx || typeof ctx !== 'object' || !firstScreenCtx || typeof firstScreenCtx !== 'object') return;

  const ctxObj = ctx as Record<string, ClosureValueType>;
  const firstScreenCtxObj = firstScreenCtx as Record<string, ClosureValueType>;

  if (ctxObj['_wkltId'] && ctxObj['_wkltId'] !== firstScreenCtxObj['_wkltId']) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-for-in-array
  for (const key in ctx) {
    if (key === '_wvid') {
      hydrateMainThreadRef(ctxObj[key] as WorkletRefId, firstScreenCtxObj as unknown as WorkletRefImpl<unknown>);
    } else if (key === '_jsFn') {
      hydrateDelayRunOnBackgroundTasks(
        ctxObj[key] as Record<string, JsFnHandle>,
        firstScreenCtxObj[key] as Record<string, JsFnHandle>,
        execId,
      );
    } else {
      const firstScreenValue = typeof firstScreenCtxObj[key] === 'function'
        ? (firstScreenCtxObj[key] as { ctx: ClosureValueType }).ctx
        : firstScreenCtxObj[key];
      hydrateCtxImpl(ctxObj[key], firstScreenValue, execId);
    }
  }
}

/**
 * Hydrates a WorkletRef on the main thread.
 * This is used to update the WorkletRef's background initial value based on changes
 * that occurred in the first-screen Worklet context before hydration.
 *
 * @param refId The ID of the WorkletRef to hydrate.
 * @param value The new value for the WorkletRef.
 */
function hydrateMainThreadRef(refId: WorkletRefId, value: WorkletRefImpl<unknown> | { current: unknown }) {
  if ('_initValue' in value) {
    // The ref has not been accessed yet.
    return;
  }
  const ref = lynxWorkletImpl!._refImpl._workletRefMap[refId]!;
  if (ref.current instanceof Element) {
    // Modified by `main-thread:ref`
    return;
  }
  ref.current = value.current;
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
      continue;
    }
    for (const index of firstScreenFnObj._delayIndices) {
      const details = lynxWorkletImpl!._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray[index]!;
      fnObj._execId = execId;
      details.jsFnHandle = fnObj;
    }
  }
}
