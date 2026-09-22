// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type { ClosureValueType, RunWorkletOptions, Worklet, WorkletRefImpl } from './bindings/types.js';
import { RunWorkletSource } from './bindings/types.js';
import { initRunOnBackgroundDelay } from './delayRunOnBackground.js';
import { delayExecUntilJsReady, initEventDelay } from './delayWorkletEvent.js';
import { initEomImpl } from './eomImpl.js';
import { addEventMethodsIfNeeded } from './eventPropagation.js';
import { hydrateCtx } from './hydrate.js';
import { JsFunctionLifecycleManager, isRunOnBackgroundEnabled } from './jsFunctionLifecycle.js';
import { isRealizedMainThreadObject } from './mainThreadObject.js';
import { runRunOnMainThreadTask } from './runOnMainThread.js';
import { mainThreadFlushLoopMark } from './utils/mainThreadFlushLoopGuard.js';
import { profile } from './utils/profile.js';
import { getFromWorkletRefMap, initWorkletRef } from './workletRef.js';

function initWorklet(): void {
  globalThis.lynxWorkletImpl = {
    _workletMap: {},
    _refImpl: initWorkletRef(),
    _runOnBackgroundDelayImpl: initRunOnBackgroundDelay(),
    _hydrateCtx: hydrateCtx,
    _eventDelayImpl: initEventDelay(),
    _eomImpl: initEomImpl(),
    _runRunOnMainThreadTask: runRunOnMainThreadTask,
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
    return;
  }

  if (__DEV__) {
    if (options?.source === RunWorkletSource.EVENT && Array.isArray(params)) {
      const first = params[0];
      const t = (first as { type?: unknown }).type;
      if (typeof t === 'string') {
        mainThreadFlushLoopMark(`event:${t}`);
      }
    }

    mainThreadFlushLoopMark(`MainThreadFunction id=${String(ctx._wkltId)}`);
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

const workletCache = /*#__PURE__*/ new WeakMap<object, ClosureValueType | ((...args: unknown[]) => unknown)>();

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

  const worklet = transformWorkletInner({ main: ctx }, 0, ctx) as { main: ClosureValueType };

  if (isWorklet) {
    workletCache.set(ctx, worklet.main);
  }

  return worklet.main;
}

const transformWorkletInner = (
  value: ClosureValueType,
  depth: number,
  ctx: unknown,
): ClosureValueType => {
  const limit = 1000;
  if (++depth >= limit) {
    throw new Error('Depth of value exceeds limit of ' + limit + '.');
  }
  /* v8 ignore next 3 */
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  let obj = value as Record<string, ClosureValueType>;

  for (const key in obj) {
    const subObj: ClosureValueType = obj[key];
    if (typeof subObj !== 'object' || subObj === null) {
      continue;
    }

    // A MainThreadObject initialization payload is user data. Resolve the
    // typed descriptor before walking it so payload properties that resemble
    // worklet metadata remain untouched. Legacy MainThreadRef descriptors retain
    // the existing recursive path.
    if (isRealizedMainThreadObject(subObj)) {
      continue;
    }
    if (isMainThreadObjectDescriptor(subObj)) {
      obj[key] = getFromWorkletRefMap(subObj);
      continue;
    }

    if (/** isEventTarget */ 'elementRefptr' in subObj) {
      obj[key] = new Element(subObj.elementRefptr as ElementNode);
      continue;
    } else if (subObj instanceof Element) {
      continue;
    }

    const transformedSubObj = transformWorkletInner(subObj, depth, ctx) as Record<string, ClosureValueType>;

    const isWorkletRef = '_wvid' in (subObj as object);
    if (isWorkletRef) {
      obj[key] = getFromWorkletRefMap(
        subObj as unknown as WorkletRefImpl<unknown>,
      );
      continue;
    }
    const isWorklet = '_wkltId' in subObj;
    if (isWorklet) {
      const isRootWorklet = subObj === ctx;
      const boundCtx = { ...transformedSubObj };
      // Keep the original context collectible. PrimJS traces WeakMap values even
      // when their keys are otherwise unreachable, so the cached function must not point back to its key.
      const boundWorklet: ((...args: unknown[]) => unknown) & { boundCtx?: object } = lynxWorkletImpl
        ._workletMap[(subObj as Worklet)._wkltId]!
        .bind(boundCtx);
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (transformedSubObj !== subObj && obj === value && obj !== ctx) obj = copyAccessorCapture(obj);
      if (descriptor?.get) {
        // Generated method getters create a fresh receiver snapshot on each capture.
        // Materialize only the captured copy; the source must keep its getter.
        if (obj === value) obj = copyAccessorCapture(obj);
        Object.defineProperty(obj, key, {
          value: boundWorklet,
          writable: true,
          enumerable: descriptor.enumerable!,
          configurable: descriptor.configurable!,
        });
      } else {
        obj[key] = boundWorklet;
      }
      if (!isRootWorklet) {
        // Hydration needs the same context that the function already owns through bind().
        // The original nested context can disappear after its parent replaces it with this function.
        boundWorklet.boundCtx = boundCtx;
      }
      continue;
    }
    if (transformedSubObj !== subObj) {
      // The root context is runtime-owned: hydration must see its captured copy.
      if (obj === value && obj !== ctx) obj = copyAccessorCapture(obj);
      obj[key] = transformedSubObj;
    }
    const isJsFn = '_jsFnId' in subObj;
    if (isJsFn) {
      (subObj as Record<string, ClosureValueType>)['_execId'] = (ctx as Worklet)._execId;
      lynxWorkletImpl._jsFunctionLifecycleManager?.addRef(
        (ctx as Worklet)._execId!,
        subObj,
      );
      continue;
    }
  }
  return obj;
};

function copyAccessorCapture(obj: Record<string, ClosureValueType>): Record<string, ClosureValueType> {
  // Copy descriptors without evaluating getters a second time. Array ancestors
  // retain their array identity when a nested accessor requires a captured copy.
  return Object.defineProperties(
    Array.isArray(obj)
      ? []
      : Object.create(Object.getPrototypeOf(obj) as object | null) as Record<string, ClosureValueType>,
    Object.getOwnPropertyDescriptors(obj),
  ) as Record<string, ClosureValueType>;
}

function isMainThreadObjectDescriptor(
  value: object,
): value is WorkletRefImpl<unknown> {
  const descriptor = value as Partial<WorkletRefImpl<unknown>>;
  return typeof descriptor._wvid === 'number'
    && typeof descriptor._type === 'string'
    && descriptor._type !== 'main-thread';
}
export { initWorklet };
