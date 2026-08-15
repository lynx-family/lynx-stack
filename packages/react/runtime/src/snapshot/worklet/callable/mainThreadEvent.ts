// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  WorkletEvents,
  loadWorkletRuntime,
  registerFirstScreenCallableCtx,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { MainThreadCallableImpl, Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { addCallableCtxPatch } from './callablePool.js';
import { useEffect, useRef } from '../../../core/hooks/react.js';
import { onPostWorkletCtx } from '../ctx.js';

// Split into two variables for testing purposes
let lastIdBG = 0;
let lastIdMT = 0;

export function clearMainThreadEventLastIdForTesting(): void {
  lastIdBG = lastIdMT = 0;
}

function isMainThreadFunction(value: unknown): value is Worklet {
  return typeof value === 'object' && value !== null && '_wkltId' in value;
}

function reportInvalidMainThreadEvent(hookName: string, value: unknown): void {
  /* v8 ignore next 3 */
  if (!__DEV__) {
    return;
  }
  const rawName = (value as { name?: string }).name;
  const fnName = rawName === undefined || rawName === '' ? '(anonymous)' : rawName;
  const description = typeof value === 'function'
    ? `function ${fnName}`
    : String(value);
  lynx.reportError(
    new Error(
      `${hookName}: expected a main-thread function but received ${description}. `
        + 'Did you forget to add a "main thread" directive?',
    ),
  );
}

/**
 * An opaque handle for a consumer-authored main-thread function.
 *
 * On the background thread the handle is inert and serializable. When it is
 * captured by a main thread function (at any nesting depth inside captured
 * objects or parameters), it resolves to a stable main-thread function whose
 * implementation always reflects the captured values of the latest committed
 * render.
 *
 * Handles are usually created through {@link useMainThreadEvent} or
 * {@link useMainThreadEvents}, which keep the transported captured values
 * up to date on rerenders and release the callable on unmount.
 *
 * This is the main-thread counterpart of React's `useEvent`/`useEffectEvent`
 * event functions: a stable identity whose body always observes the latest
 * committed render, callable only outside of rendering — a constraint the
 * thread boundary enforces structurally, since the callable form of the
 * function only exists on the main thread.
 *
 * @public
 */
export class MainThreadEvent<F extends (...args: any[]) => any = (...args: unknown[]) => unknown> {
  /** @internal */
  declare private _phantomType?: F;
  /** @internal */
  protected _wcid: number;
  /** @internal */
  private _stagedJson: string | undefined;
  /** @internal */
  private _released = false;
  /** @internal */
  protected _lifecycleObserver?: unknown;

  constructor(fn: F) {
    if (__JS__) {
      this._wcid = ++lastIdBG;
      this._update(fn);

      const id = this._wcid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseMainThreadCallable,
          data: { id },
        });
      });
    } else {
      this._wcid = --lastIdMT;
      const schema = (globalThis as { globDynamicComponentEntry?: string })
        .globDynamicComponentEntry;
      loadWorkletRuntime(schema);
      registerFirstScreenCallableCtx(this._wcid, fn as unknown as Worklet);
    }
  }

  /**
   * Stage the latest main-thread function (with fresh captured values) to be
   * flushed to the main thread with the next commit.
   *
   * @internal
   */
  _update(fn: F): void {
    if (!__JS__ || this._released) {
      return;
    }
    const raw = fn as unknown as Worklet;
    const json = JSON.stringify(raw);
    // Background function identities inside `_jsFn` are not observable in
    // JSON, so ctxs carrying them are always re-pushed.
    if (json === this._stagedJson && raw._jsFn === undefined) {
      return;
    }
    const ctx = onPostWorkletCtx({ ...raw });
    if (!ctx) {
      return;
    }
    this._stagedJson = json;
    addCallableCtxPatch(this._wcid, ctx);
  }

  /**
   * Stage a release of the main-thread ctx while keeping the handle reusable.
   *
   * @internal
   */
  _clear(): void {
    if (!__JS__ || this._released || this._stagedJson === undefined) {
      return;
    }
    this._stagedJson = undefined;
    addCallableCtxPatch(this._wcid, null);
  }

  /**
   * Release the callable on the main thread. Calling the realized main-thread
   * function after release is a no-op returning `undefined` (and throws in
   * development builds).
   *
   * This is called automatically on unmount by {@link useMainThreadEvent}
   * and {@link useMainThreadEvents}.
   *
   * @public
   */
  release(): void {
    if (!__JS__ || this._released) {
      return;
    }
    this._released = true;
    addCallableCtxPatch(this._wcid, null);
  }

  /** @internal */
  toJSON(): MainThreadCallableImpl {
    return {
      _wcid: this._wcid,
    };
  }
}

/**
 * Register a consumer-authored main-thread function as a lifecycle-managed
 * main-thread event function — the main-thread counterpart of React's
 * `useEffectEvent`.
 *
 * The returned {@link MainThreadEvent} handle is serializable and may be
 * embedded in objects or arrays passed to main thread functions. Wherever a
 * main thread function receives the handle (as a captured value or as a
 * parameter, at any nesting depth), it resolves to a stable main-thread
 * function.
 *
 * - The realized function identity is stable for the component lifetime, so
 *   long-lived main-thread consumers (animation loops, style effects) may
 *   retain it.
 * - Captured values of `fn` are re-synchronized with the main thread on every
 *   committed render.
 * - The callable is released on unmount.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param fn - The main-thread function to transport, or `null` / `undefined`.
 * @returns The handle, or `null` when `fn` is `null` or `undefined`.
 *
 * @example
 *
 * ```tsx
 * import { useMainThreadEvent } from '@lynx-js/react'
 *
 * function MyMotionComponent(props) {
 *   const transformTemplate = useMainThreadEvent(props.transformTemplate)
 *
 *   function updateStyles() {
 *     'main thread'
 *     // `transformTemplate` resolves to a callable function here.
 *     const transform = transformTemplate ? transformTemplate(latest, generated) : generated
 *     // ...
 *   }
 *   // ...
 * }
 * ```
 *
 * @public
 */
export function useMainThreadEvent<F extends (...args: any[]) => any>(
  fn: F | null | undefined,
): MainThreadEvent<F> | null {
  const handleRef = useRef<MainThreadEvent<F> | null>(null);

  let mainThreadFn: F | null = fn ?? null;
  if (mainThreadFn !== null && !isMainThreadFunction(mainThreadFn)) {
    reportInvalidMainThreadEvent('useMainThreadEvent', mainThreadFn);
    mainThreadFn = null;
  }

  if (mainThreadFn === null) {
    handleRef.current?._clear();
  } else if (handleRef.current === null) {
    handleRef.current = new MainThreadEvent(mainThreadFn);
  } else {
    handleRef.current._update(mainThreadFn);
  }

  useEffect(() => {
    return () => {
      handleRef.current?.release();
    };
  }, []);

  return mainThreadFn === null ? null : handleRef.current;
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function transportNestedEvents(
  value: unknown,
  path: string,
  slots: Map<string, MainThreadEvent>,
  seen: Set<string>,
  depth: number,
): unknown {
  const limit = 1000;
  if (depth >= limit) {
    throw new Error('useMainThreadEvents: depth of value exceeds limit of ' + limit + '.');
  }
  if (typeof value !== 'object' || value === null) {
    if (typeof value === 'function') {
      reportInvalidMainThreadEvent('useMainThreadEvents', value);
    }
    return value;
  }
  if (isMainThreadFunction(value)) {
    seen.add(path);
    let handle = slots.get(path);
    const fn = value as unknown as (...args: unknown[]) => unknown;
    if (handle === undefined) {
      handle = new MainThreadEvent(fn);
      slots.set(path, handle);
    } else {
      handle._update(fn);
    }
    return handle;
  }
  if (value instanceof MainThreadEvent) {
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const result = value.map((item: unknown, index: number) => {
      const transported = transportNestedEvents(item, path + '.' + index, slots, seen, depth + 1);
      changed ||= transported !== item;
      return transported;
    });
    return changed ? result : value;
  }
  if (isPlainObject(value)) {
    let changed = false;
    const result: Record<string, unknown> = {};
    for (const key in value) {
      const item = (value as Record<string, unknown>)[key];
      const transported = transportNestedEvents(item, path + '.' + key, slots, seen, depth + 1);
      changed ||= transported !== item;
      result[key] = transported;
    }
    return changed ? result : value;
  }
  // Other object kinds (MainThreadRef, main-thread object handles, class
  // instances, ...) pass through untouched.
  return value;
}

/**
 * Register every main-thread function nested inside `value` as a
 * lifecycle-managed main-thread callable.
 *
 * `value` is walked structurally (plain objects and arrays). Each discovered
 * main-thread function is replaced by a {@link MainThreadEvent} handle
 * keyed by its structural path, so the same slot keeps the same callable
 * identity across rerenders while its captured values are re-synchronized.
 * Slots that disappear from `value` are released, and all slots are released
 * on unmount.
 *
 * On the main thread, wherever a main thread function receives the returned
 * value, every handle resolves back to a callable function, so the value can
 * be forwarded to main-thread consumers unchanged. The static type of the
 * returned value is therefore kept as `T`.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param value - A value that may contain main-thread functions at any depth.
 * @returns The transported value. Containers are cloned only along paths that
 * contain callables; a value without main-thread functions is returned as-is.
 *
 * @example
 *
 * ```tsx
 * import { useMainThreadEvents, runOnMainThread } from '@lynx-js/react'
 *
 * function MyMotionComponent(props) {
 *   // `props.transition` may contain nested easing functions, e.g.
 *   // { duration: 0.8, ease: [(p) => { 'main thread'; return p }, easeOut] }
 *   const transition = useMainThreadEvents(props.transition)
 *
 *   function applyAnimation(options) {
 *     'main thread'
 *     // options.ease[0] is a callable function here.
 *   }
 *
 *   useEffect(() => {
 *     void runOnMainThread(applyAnimation)(transition)
 *   }, [transition])
 *   // ...
 * }
 * ```
 *
 * @public
 */
export function useMainThreadEvents<T>(value: T): T {
  const slotsRef = useRef<Map<string, MainThreadEvent> | null>(null);
  slotsRef.current ??= new Map();
  const slots = slotsRef.current;

  const seen = new Set<string>();
  const result = transportNestedEvents(value, '', slots, seen, 0) as T;

  for (const [path, handle] of slots) {
    if (!seen.has(path)) {
      handle.release();
      slots.delete(path);
    }
  }

  useEffect(() => {
    return () => {
      const slots = slotsRef.current!;
      for (const handle of slots.values()) {
        handle.release();
      }
      slots.clear();
    };
  }, []);

  return result;
}
