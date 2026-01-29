// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import { WorkletEvents } from './bindings/events.js';
import type { ClosureValueType, RunWorkletOptions, Worklet, WorkletRefImpl } from './bindings/types.js';
import { initRunOnBackgroundDelay } from './delayRunOnBackground.js';
import { delayExecUntilJsReady, initEventDelay } from './delayWorkletEvent.js';
import { initEomImpl } from './eomImpl.js';
import { addEventMethodsIfNeeded } from './eventPropagation.js';
import { hydrateCtx } from './hydrate.js';
import { JsFunctionLifecycleManager, isRunOnBackgroundEnabled } from './jsFunctionLifecycle.js';
import { runRunOnMainThreadTask } from './runOnMainThread.js';
import { profile } from './utils/profile.js';
import './Ref.js';
import {
  getFromWorkletRefMap,
  getMainThreadValueClassMap,
  initWorkletRef,
  removeValueFromWorkletRefMap,
} from './workletRef.js';

function initWorklet(): void {
  // Capture existing type registry (may contain types registered before init)
  const stagingMap = getMainThreadValueClassMap();

  globalThis.lynxWorkletImpl = {
    _workletMap: {},
    _mainThreadValueClassMap: stagingMap,
    _refImpl: initWorkletRef(),
    _runOnBackgroundDelayImpl: initRunOnBackgroundDelay(),
    _hydrateCtx: hydrateCtx,
    _eventDelayImpl: initEventDelay(),
    _eomImpl: initEomImpl(),
    _runRunOnMainThreadTask: runRunOnMainThreadTask,
  };

  // Listen for release events to clean up refs
  lynx.getCoreContext().addEventListener(
    WorkletEvents.releaseWorkletRef,
    (evt: { data: { id: number } }) => {
      removeValueFromWorkletRefMap(evt.data.id);
    },
  );

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
function registerWorklet(_type: string, id: string, worklet: (...args: unknown[]) => unknown): void {
  lynxWorkletImpl._workletMap[id] = worklet;
}

/**
 * Entrance of all worklet calls.
 * Native event touch handler will call this function.
 * @param ctx worklet object.
 * @param params worklet params.
 * @param options run worklet options.
 */
function runWorklet(ctx: Worklet, params: ClosureValueType[], options?: RunWorkletOptions): unknown {
  if (!validateWorklet(ctx)) {
    console.warn('Worklet: Invalid worklet object: ' + JSON.stringify(ctx));
    return;
  }
  if ('_lepusWorkletHash' in ctx) {
    delayExecUntilJsReady(ctx._lepusWorkletHash, params);
    return;
  }
  return runWorkletImpl(ctx, params, options);
}

function runWorkletImpl(ctx: Worklet, params: ClosureValueType[], options?: RunWorkletOptions): unknown {
  const worklet: (...args: unknown[]) => unknown = profile(
    'transformWorkletCtx ' + ctx._wkltId,
    () => transformWorklet(ctx, true),
  );
  const params_: ClosureValueType[] = profile(
    'transformWorkletParams',
    () => transformWorklet(params || [], false),
  );

  const [hasEventMethods, eventCtx] = addEventMethodsIfNeeded(params_, options);

  const result = profile('runWorklet', () => worklet(...params_));

  if (hasEventMethods) {
    return {
      returnValue: result,
      eventReturnResult: eventCtx._eventReturnResult,
    };
  }

  return result;
}

function validateWorklet(ctx: unknown): ctx is Worklet {
  return typeof ctx === 'object' && ctx !== null && ('_wkltId' in ctx || '_lepusWorkletHash' in ctx);
}

const workletCache = new WeakMap<object, ClosureValueType | ((...args: unknown[]) => unknown)>();

function transformWorklet(ctx: Worklet, isWorklet: true): (...args: unknown[]) => unknown;
function transformWorklet(
  ctx: ClosureValueType[],
  isWorklet: false,
): ClosureValueType[];

function transformWorklet(
  ctx: ClosureValueType,
  isWorklet: boolean,
): ClosureValueType | ((...args: unknown[]) => unknown) {
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
  value: ClosureValueType,
  depth: number,
  ctx?: unknown,
) => {
  const limit = 1000;
  if (++depth >= limit) {
    throw new Error('Depth of value exceeds limit of ' + limit + '.');
  }
  /* v8 ignore next 3 */
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const obj = value as Record<string, ClosureValueType>;

  for (const key in obj) {
    const subObj: ClosureValueType = obj[key];
    if (typeof subObj !== 'object' || subObj === null) {
      continue;
    }

    if (/** isEventTarget */ 'elementRefptr' in subObj) {
      obj[key] = new Element(subObj['elementRefptr'] as ElementNode);
      continue;
    } else if (subObj instanceof Element) {
      continue;
    }

    transformWorkletInner(subObj, depth, ctx);

    // Detect WorkletRef and MainThreadValue objects (both have _wvid)
    // The hydration in getFromWorkletRefMap handles type-aware instantiation
    const isWorkletRef = '_wvid' in (subObj as object);
    if (isWorkletRef) {
      obj[key] = getFromWorkletRefMap(
        subObj as unknown as WorkletRefImpl<unknown>,
      );
      continue;
    }
    const isWorklet = '_wkltId' in subObj;
    if (isWorklet) {
      // `subObj` is worklet ctx. Shallow copy it to prevent the transformed worklet from referencing ctx.
      // This would result in the value of `workletCache` referencing its key.
      obj[key] = lynxWorkletImpl._workletMap[(subObj as Worklet)._wkltId]!
        .bind({ ...subObj });
      obj[key].ctx = subObj;
      continue;
    }
    const isJsFn = '_jsFnId' in subObj;
    if (isJsFn && ctx) {
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
