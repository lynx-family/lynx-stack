// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  WorkletEvents,
  loadWorkletRuntime,
  registerFirstScreenCallableCtx,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadInstanceImpl, Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { addCallableCtxPatch } from './callablePool.js';
import {
  allocateCallableIdBG,
  allocateCallableIdMT,
  isMainThreadFunction,
  reportInvalidMainThreadFunction,
} from './mainThreadEvent.js';
import { useEffect, useRef } from '../../../core/hooks/react.js';
import { onPostWorkletCtx } from '../ctx.js';
import type { MainThreadFn } from '../mainThread.js';

/**
 * An opaque handle for an object created and owned by the main thread.
 *
 * On the background thread the handle is inert and serializable. When it is
 * captured by a main thread function (at any nesting depth inside captured
 * objects or parameters), it realizes to the object returned by the `create`
 * function — run on the main thread on first use, then cached, so the object
 * identity is stable for the handle's lifetime.
 *
 * This is the main-thread counterpart of the create-once "instance" idiom of
 * React (`useState(() => new Thing())` / a lazily-initialized `useRef`):
 * a stable identity created once and disposed on unmount. Unlike a
 * {@link MainThreadEvent}, the captured values of `create` are frozen at
 * construction — rerenders do not re-synchronize them.
 *
 * @public
 */
export class MainThreadInstance<O = unknown> {
  /** @internal */
  declare private _phantomType?: O;
  /** @internal */
  protected _wiid: number;
  /** @internal */
  private _released = false;
  /** @internal */
  protected _lifecycleObserver?: unknown;

  constructor(create: () => O, dispose?: (obj: O) => void) {
    if (__JS__) {
      this._wiid = allocateCallableIdBG();

      const disposeCtx = dispose === undefined
        ? undefined
        : onPostWorkletCtx({ ...(dispose as unknown as Worklet) });
      const ctx = onPostWorkletCtx({ ...(create as unknown as Worklet) });
      if (ctx) {
        if (disposeCtx) {
          ctx['_instDispose'] = disposeCtx;
        }
        addCallableCtxPatch(this._wiid, ctx);
      }

      const id = this._wiid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseMainThreadCallable,
          data: { id },
        });
      });
    } else {
      this._wiid = allocateCallableIdMT();
      const schema = (globalThis as { globDynamicComponentEntry?: string })
        .globDynamicComponentEntry;
      loadWorkletRuntime(schema);
      const ctx = { ...(create as unknown as Worklet) };
      if (dispose !== undefined) {
        ctx['_instDispose'] = dispose as unknown as Worklet;
      }
      registerFirstScreenCallableCtx(this._wiid, ctx);
    }
  }

  /**
   * Release the instance on the main thread. If the instance was realized and
   * a `dispose` function was provided, `dispose` runs with the realized
   * object before the slot is cleared. Releases are flushed after the
   * commit's patch, so main-thread tasks scheduled by the unmounting commit
   * may still use the instance.
   *
   * This is called automatically on unmount by {@link useMainThreadInstance}.
   *
   * @public
   */
  release(): void {
    if (!__JS__ || this._released) {
      return;
    }
    this._released = true;
    addCallableCtxPatch(this._wiid, null);
  }

  /** @internal */
  toJSON(): MainThreadInstanceImpl {
    return {
      _wiid: this._wiid,
    };
  }
}

/**
 * Create an object on the main thread, once, with its lifetime bound to the
 * component: the main-thread counterpart of React's create-once instance
 * idiom (`useState(() => new Thing())`), with a deterministic `dispose`.
 *
 * The returned {@link MainThreadInstance} handle is serializable and may be
 * embedded in objects or arrays passed to main thread functions. Wherever a
 * main thread function receives the handle, it realizes to the object
 * returned by `create` — run on the main thread on first use, then cached.
 *
 * - `create` runs at most once; the realized object identity is stable for
 *   the component lifetime.
 * - Captured values of `create` and `dispose` are frozen at first commit;
 *   rerenders do not re-synchronize them (unlike {@link useMainThreadEvent}).
 * - On unmount the instance is released: `dispose` (if provided) runs with
 *   the realized object, after the unmounting commit's patch — so main-thread
 *   tasks scheduled by that commit may still use the instance.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param create - A main-thread function creating the object, or `null` /
 * `undefined`. The first non-null value across renders wins.
 * @param dispose - An optional main-thread function receiving the realized
 * object when the instance is released.
 * @returns The handle. `null` until the first render that provides a `create`
 * function; stable afterwards, even if later renders pass `null`.
 *
 * @example
 *
 * ```tsx
 * import { useMainThreadInstance } from '@lynx-js/react'
 *
 * function MyMotionComponent() {
 *   const value = useMainThreadInstance(
 *     () => {
 *       'main thread'
 *       return motionValue(0)
 *     },
 *     (v) => {
 *       'main thread'
 *       v.stop()
 *     },
 *   )
 *
 *   function applyAnimation() {
 *     'main thread'
 *     // `value` realizes to the motionValue object here.
 *     value.set(1)
 *   }
 *   // ...
 * }
 * ```
 *
 * @public
 */
export function useMainThreadInstance<O>(
  create: MainThreadFn<[], O> | null | undefined,
  dispose?: MainThreadFn<[obj: O], void> | null,
): MainThreadInstance<O> | null {
  const handleRef = useRef<MainThreadInstance<O> | null>(null);

  let createFn: (() => O) | null = create ?? null;
  if (createFn !== null && !isMainThreadFunction(createFn)) {
    reportInvalidMainThreadFunction('useMainThreadInstance', createFn);
    createFn = null;
  }
  let disposeFn: ((obj: O) => void) | undefined = dispose ?? undefined;
  if (disposeFn !== undefined && !isMainThreadFunction(disposeFn)) {
    reportInvalidMainThreadFunction('useMainThreadInstance', disposeFn);
    disposeFn = undefined;
  }

  if (createFn !== null && handleRef.current === null) {
    handleRef.current = new MainThreadInstance(createFn, disposeFn);
  }

  useEffect(() => {
    return () => {
      handleRef.current?.release();
    };
  }, []);

  return handleRef.current;
}
