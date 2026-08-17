// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ClosureValueType,
  MainThreadCallableCtxPatch,
  MainThreadCallableId,
  MainThreadCallableImpl,
  MainThreadCallableRunPatch,
  MainThreadInstanceImpl,
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
  runCallableCtxs(ids: MainThreadCallableRunPatch): void;
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

/**
 * The realized `MainThreadInstance` objects, one stable identity per id.
 * Boxed so that instances realizing to `undefined` are still cached.
 */
const instanceMap = new Map<MainThreadCallableId, { value: unknown }>();

/**
 * Per-id teardown run when the callable is released: the dispose function of a
 * realized `MainThreadInstance`, or the pending cleanup returned by the last
 * run of a `useMainThreadEffect` ctx. Effect cleanups also run before the
 * next run of the same id.
 */
const releaseHookMap = new Map<MainThreadCallableId, () => void>();

function initCallable(): CallableImpl {
  wrapperMap.clear();
  instanceMap.clear();
  releaseHookMap.clear();
  return (impl = {
    _callableCtxMap: {},
    _firstScreenCallableCtxMap: {},
    updateCallableCtxChanges,
    runCallableCtxs,
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
 * Returns the realized main-thread function for a `MainThreadEvent` handle.
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
          'MainThreadEvent: event ' + id + ' is not registered. It may have been released on unmount.',
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
 * Returns the realized object for a `MainThreadInstance` handle. The `create`
 * ctx is run on the first deref; the resulting object identity is stable for
 * the handle's lifetime. If the ctx carries a `_instDispose` worklet, it is
 * registered to run with the realized object when the callable is released.
 */
const getFromInstanceMap = (handle: MainThreadInstanceImpl): unknown => {
  const id = handle._wiid;
  const cached = instanceMap.get(id);
  if (cached) {
    return cached.value;
  }
  const ctx = resolveCallableCtx(id);
  if (!ctx) {
    /* v8 ignore next 5 -- the production fallback branch is not built in tests */
    if (__DEV__) {
      throw new Error(
        'MainThreadInstance: instance ' + id + ' is not registered. It may have been released on unmount.',
      );
    }
    /* v8 ignore next 2 */
    return undefined;
  }
  // Read the dispose ctx before running `create`: the transform binds nested
  // worklet fields of `ctx` in place, and we want the raw ctx to run later.
  const disposeCtx = ctx['_instDispose'] as Worklet | undefined;
  const value = globalThis.runWorklet(ctx, []);
  instanceMap.set(id, { value });
  if (disposeCtx) {
    releaseHookMap.set(id, () => {
      globalThis.runWorklet(disposeCtx, [value as ClosureValueType]);
    });
  }
  return value;
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

/**
 * Runs the ctxs scheduled by `useMainThreadEffect`, after the commit's patch
 * has been applied. The pending cleanup of a previous run is called first;
 * a function returned by the run is stored as the next cleanup and also runs
 * when the callable is released.
 */
function runCallableCtxs(ids: MainThreadCallableRunPatch): void {
  profile('runCallableCtxs', () => {
    ids.forEach((id) => {
      const ctx = resolveCallableCtx(id);
      if (!ctx) {
        return;
      }
      runReleaseHook(id);
      const res = globalThis.runWorklet(ctx, []);
      if (typeof res === 'function') {
        releaseHookMap.set(id, res as () => void);
      }
    });
  });
}

function registerFirstScreenCallableCtx(id: MainThreadCallableId, ctx: Worklet): void {
  impl!._firstScreenCallableCtxMap[id] = ctx;
}

function runReleaseHook(id: MainThreadCallableId): void {
  const hook = releaseHookMap.get(id);
  if (hook) {
    releaseHookMap.delete(id);
    hook();
  }
}

function removeCallable(id: MainThreadCallableId): void {
  runReleaseHook(id);
  if (impl) {
    delete impl._callableCtxMap[id];
  }
  wrapperMap.delete(id);
  instanceMap.delete(id);
}

function clearFirstScreenCallableCtxMap(): void {
  // First-screen instances are not carried across hydration: their release
  // hooks (disposes) run now, before the background render re-creates them
  // under fresh positive ids.
  for (const id of Array.from(releaseHookMap.keys())) {
    if (id < 0) {
      runReleaseHook(id);
    }
  }
  for (const id of Array.from(instanceMap.keys())) {
    if (id < 0) {
      instanceMap.delete(id);
    }
  }
  impl!._firstScreenCallableCtxMap = {};
}

export {
  type CallableImpl,
  initCallable,
  getFromCallableMap,
  getFromInstanceMap,
  removeCallable,
  updateCallableCtxChanges,
  runCallableCtxs,
};
