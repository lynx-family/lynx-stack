// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ClosureValueType,
  MainThreadCallableCtxPatch,
  MainThreadCallableId,
  MainThreadCallableImpl,
  Worklet,
} from './bindings/types.js';
import { profile } from './utils/profile.js';

interface CallableImpl {
  /**
   * Map from callable id to the latest worklet ctx pushed by the background thread.
   * Ids are positive.
   */
  _callableCtxMap: Record<MainThreadCallableId, Worklet>;
  /**
   * Map of callable ctxs registered during first screen rendering.
   * These callables are created with negative IDs. The map is cleared
   * after hydration is complete to free up memory.
   */
  _firstScreenCallableCtxMap: Record<MainThreadCallableId, Worklet>;
  updateCallableCtxChanges(patch: MainThreadCallableCtxPatch): void;
  registerFirstScreenCallableCtx(id: MainThreadCallableId, ctx: Worklet): void;
  clearFirstScreenCallableCtxMap(): void;
}

let impl: CallableImpl | undefined;

/**
 * The realized main-thread functions, one stable identity per callable id.
 * Kept outside of `impl` so that wrappers retained across a runtime reload
 * do not resurrect stale ctx maps.
 */
const wrapperMap = new Map<MainThreadCallableId, (...args: unknown[]) => unknown>();

function initCallable(): CallableImpl {
  wrapperMap.clear();
  return (impl = {
    _callableCtxMap: {},
    _firstScreenCallableCtxMap: {},
    updateCallableCtxChanges,
    registerFirstScreenCallableCtx,
    clearFirstScreenCallableCtxMap,
  });
}

function resolveCallableCtx(id: MainThreadCallableId): Worklet | undefined {
  if (id < 0) {
    return impl?._firstScreenCallableCtxMap[id];
  }
  return impl?._callableCtxMap[id];
}

/**
 * Returns the realized main-thread function for a `MainThreadCallable` handle.
 * The returned function identity is stable per callable id; each call resolves
 * the latest ctx installed by the background thread.
 */
const getFromCallableMap = (
  handle: MainThreadCallableImpl,
): (...args: unknown[]) => unknown => {
  const id = handle._wcid;
  let wrapper = wrapperMap.get(id);
  if (!wrapper) {
    wrapper = (...args: unknown[]): unknown => {
      const ctx = resolveCallableCtx(id);
      if (ctx) {
        return globalThis.runWorklet?.(ctx, args as ClosureValueType[]);
      }
      /* v8 ignore next 5 -- the production fallback branch is not built in tests */
      if (__DEV__) {
        throw new Error(
          'MainThreadCallable: callable ' + id + ' is not registered. It may have been released on unmount.',
        );
      }
      /* v8 ignore next */
      return undefined;
    };
    wrapperMap.set(id, wrapper);
  }
  return wrapper;
};

/**
 * Installs the latest ctx for each callable id. A `null` ctx releases the callable.
 */
function updateCallableCtxChanges(patch: MainThreadCallableCtxPatch): void {
  profile('updateCallableCtxChanges', () => {
    patch.forEach(([id, ctx]) => {
      if (ctx === null) {
        removeCallable(id);
        return;
      }
      impl!._callableCtxMap[id] = ctx;
      // Retain the installed ctx so background exec contexts of nested
      // `runOnBackground` handles are released once this ctx is replaced
      // or removed and garbage collected.
      if (ctx._execId !== undefined) {
        lynxWorkletImpl._jsFunctionLifecycleManager?.addRef(ctx._execId, ctx);
      }
    });
  });
}

function registerFirstScreenCallableCtx(id: MainThreadCallableId, ctx: Worklet): void {
  impl!._firstScreenCallableCtxMap[id] = ctx;
}

function removeCallable(id: MainThreadCallableId): void {
  if (impl) {
    delete impl._callableCtxMap[id];
  }
  wrapperMap.delete(id);
}

function clearFirstScreenCallableCtxMap(): void {
  impl!._firstScreenCallableCtxMap = {};
}

export { type CallableImpl, initCallable, getFromCallableMap, removeCallable, updateCallableCtxChanges };
