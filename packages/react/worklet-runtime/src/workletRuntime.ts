// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type { ClosureValueType, Worklet, WorkletRefImpl } from './bindings/types.js';
import { clearCurrentCtx, traceCtxCall } from './ctxTrace.js';
import { delayExecUntilJsReady, initEventDelay } from './delayWorkletEvent.js';
import { JsFunctionLifecycleManager, isRunOnBackgroundEnabled } from './jsFunctionLifecycle.js';
import { profile } from './utils/profile.js';
import { getFromWorkletRefMap, initWorkletRef } from './workletRef.js';

function initWorklet(): void {
  globalThis.lynxWorkletImpl = {
    _workletMap: {},
    _eventDelayImpl: initEventDelay(),
    _refImpl: initWorkletRef(),
  };

  if (isRunOnBackgroundEnabled()) {
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager = new JsFunctionLifecycleManager();
  }

  globalThis.registerWorklet = registerWorklet;
  globalThis.registerWorkletInternal = registerWorklet;
  globalThis.runWorklet = runWorklet;
}

/**
 * Register a worklet function, allowing it to be executed by `runWorklet()`.
 * This is called in lepus.js.
 * @param _type worklet type, 'main-thread' or 'ui'
 * @param id worklet hash
 * @param worklet worklet function
 */
function registerWorklet(_type: string, id: string, worklet: (...args: any[]) => any): void {
  lynxWorkletImpl._workletMap[id] = worklet;
}

/**
 * Entrance of all worklet calls.
 * Native event touch handler will call this function.
 * @param ctx worklet object.
 * @param params worklet params.
 */
function runWorklet(ctx: Worklet, params: ClosureValueType[]): unknown {
  if (!validateWorklet(ctx)) {
    console.warn('Worklet: Invalid worklet object: ' + JSON.stringify(ctx));
    return;
  }
  if ('_lepusWorkletHash' in ctx) {
    delayExecUntilJsReady(ctx._lepusWorkletHash, params);
    return;
  }
  return runWorkletImpl(ctx, params);
}

function runWorkletImpl(ctx: Worklet, params: ClosureValueType[]): unknown {
  traceCtxCall(ctx, params);
  try {
    const worklet: (...args: any[]) => unknown = profile(
      'transformWorkletCtx ' + ctx._wkltId,
      () => transformWorklet(ctx, true),
    );
    const params_: ClosureValueType[] = profile(
      'transformWorkletParams',
      () => transformWorklet(params || [], false),
    );
    return profile('runWorklet', () => worklet(...params_));
  } finally {
    clearCurrentCtx();
  }
}

function validateWorklet(ctx: unknown): ctx is Worklet {
  return typeof ctx === 'object' && ctx !== null && ('_wkltId' in ctx || '_lepusWorkletHash' in ctx);
}

const workletCache = new WeakMap<object, ClosureValueType | ((...args: any[]) => any)>();

function transformWorklet(ctx: Worklet, isWorklet: true): (...args: any[]) => any;
function transformWorklet(
  ctx: ClosureValueType[],
  isWorklet: false,
): ClosureValueType[];

function transformWorklet(
  ctx: ClosureValueType,
  isWorklet: boolean,
): ClosureValueType | ((...args: any[]) => any) {
  /* v8 ignore next 3 */
  if (typeof ctx !== 'object' || ctx === null) {
    return ctx;
  }

  if (isWorklet) {
    const res = workletCache.get(ctx);
    if (res) {
      return res;
    }
  }

  const worklet = { main: ctx };
  transformWorkletInner(worklet, 0, ctx);

  if (isWorklet) {
    workletCache.set(ctx, worklet.main);
  }
  return worklet.main;
}

const transformWorkletInner = (
  obj: ClosureValueType,
  depth: number,
  ctx: unknown,
) => {
  const limit = 1000;
  if (++depth >= limit) {
    throw new Error('Depth of value exceeds limit of ' + limit + '.');
  }
  /* v8 ignore next 3 */
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  for (const key in obj) {
    // @ts-ignore
    const subObj: ClosureValueType = obj[key];
    if (typeof subObj !== 'object' || subObj === null) {
      continue;
    }

    const isEventTarget = 'elementRefptr' in subObj;
    if (!isEventTarget) {
      transformWorkletInner(subObj, depth, ctx);
    }

    if (isEventTarget) {
      // @ts-ignore
      obj[key] = new Element(subObj['elementRefptr'] as ElementNode);
      continue;
    }
    const isWorkletRef = '_wvid' in (subObj as object);
    if (isWorkletRef) {
      // @ts-ignore
      obj[key] = getFromWorkletRefMap(
        (subObj as any as WorkletRefImpl<unknown>)._wvid,
      );
      continue;
    }
    const isWorklet = '_wkltId' in subObj;
    if (isWorklet) {
      // `subObj` is worklet ctx. Shallow copy it to prevent the transformed worklet from referencing ctx.
      // This would result in the value of `workletCache` referencing its key.
      // @ts-ignore
      obj[key] = lynxWorkletImpl._workletMap[(subObj as Worklet)._wkltId]!
        .bind({ ...subObj });
      continue;
    }
    const isJsFn = '_jsFnId' in subObj;
    if (isJsFn) {
      subObj['_execId'] = (ctx as Worklet)._execId;
      lynxWorkletImpl._jsFunctionLifecycleManager?.addRef(
        (ctx as Worklet)._execId!,
        subObj,
      );
      continue;
    }
  }
};

export { initWorklet };
