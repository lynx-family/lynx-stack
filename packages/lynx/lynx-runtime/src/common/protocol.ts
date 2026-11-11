// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Unsubscribe } from './types.js';

/**
 * Native Engine / Native ContextProxy event names (Lynx SDK 3.4+).
 */
export const NATIVE_EVENT_RENDER_PAGE = '__RenderPage';
export const NATIVE_EVENT_UPDATE_PAGE = '__UpdatePage';
export const NATIVE_EVENT_UPDATE_GLOBAL_PROPS = '__UpdateGlobalProps';
export const NATIVE_EVENT_DESTROY_LIFETIME = '__DestroyLifetime';

export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

type AnySlotFn = (...args: unknown[]) => void;

interface SlotDispatcher extends AnySlotFn {
  __listeners?: Map<AnySlotFn, Unsubscribe>;
  __prev?: AnySlotFn | undefined;
  __hadOwn?: boolean;
  __beforeDispatch?: AnySlotFn | undefined;
  __afterDispatch?: AnySlotFn | undefined;
}

// Keep subscriptions on the same dispatcher even if a host wrapper captures it.
const slotDispatchers = new WeakMap<object, Map<string, SlotDispatcher>>();

/**
 * Invoke every callback in `callbacks` even if an earlier callback throws,
 * then rethrow the first caught error so no exception is swallowed.
 */
export function invokeAll(callbacks: Iterable<() => void>): void {
  let firstError: unknown;
  let hasError = false;
  for (const fn of callbacks) {
    try {
      fn();
    } catch (err) {
      if (!hasError) {
        hasError = true;
        firstError = err;
      }
    }
  }
  if (hasError) {
    throw firstError;
  }
}

/**
 * Lazily install a single dispatcher wrapper on `target[key]` shared by all subscribers.
 * - Preserves and invokes the callback installed before subscription. Later wrappers
 *   may call this dispatcher normally; replacing the slot bypasses its subscribers.
 * - Runs `beforeDispatch` before callbacks and `afterDispatch` after every callback,
 *   including when a callback throws.
 * - Ensures all listeners still execute if an earlier listener throws, rethrowing the first error.
 * - Supports out-of-order unsubscribe in O(1) and restores `prev` when the last subscriber leaves.
 */
export function subscribeSlot<Args extends unknown[]>(
  target: object,
  key: string,
  listener: (...args: Args) => void,
  beforeDispatch?: (...args: Args) => void,
  afterDispatch?: (...args: Args) => void,
): Unsubscribe {
  const record = target as Record<string, SlotDispatcher | undefined>;
  let dispatchers = slotDispatchers.get(target);
  if (!dispatchers) {
    dispatchers = new Map();
    slotDispatchers.set(target, dispatchers);
  }
  let dispatcher = dispatchers.get(key);

  if (dispatcher) {
    dispatcher.__beforeDispatch ??= beforeDispatch as AnySlotFn | undefined;
    dispatcher.__afterDispatch ??= afterDispatch as AnySlotFn | undefined;
  } else {
    const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
    const prev = record[key];
    const set = new Map<AnySlotFn, Unsubscribe>();
    const wrapped: SlotDispatcher = function(
      this: unknown,
      ...args: unknown[]
    ): void {
      // A wrapper outside Runtime may still retain this dispatcher after unsubscribe.
      if (set.size === 0) {
        prev?.apply(this, args);
        return;
      }
      const callbacks = [...set].map(([fn, registration]) => () => {
        if (set.get(fn) === registration) fn(...args);
      });
      if (prev) {
        callbacks.unshift(() => prev.apply(this, args));
      }
      invokeAll([
        () => {
          wrapped.__beforeDispatch?.(...args);
          invokeAll(callbacks);
        },
        () => wrapped.__afterDispatch?.(...args),
      ]);
    };
    wrapped.__listeners = set;
    wrapped.__prev = prev;
    wrapped.__hadOwn = hadOwn;
    wrapped.__beforeDispatch = beforeDispatch as AnySlotFn | undefined;
    wrapped.__afterDispatch = afterDispatch as AnySlotFn | undefined;
    record[key] = wrapped;
    dispatchers.set(key, wrapped);
    dispatcher = wrapped;
  }

  const currentDispatchers = dispatchers;
  const currentDispatcher = dispatcher;
  const listeners = currentDispatcher.__listeners!;
  const typedListener = listener as AnySlotFn;
  const existing = listeners.get(typedListener);
  if (existing) return existing;

  const dispose = (): void => {
    if (listeners.get(typedListener) !== dispose) return;
    listeners.delete(typedListener);
    if (
      listeners.size > 0 || currentDispatchers.get(key) !== currentDispatcher
    ) {
      return;
    }
    currentDispatchers.delete(key);
    if (record[key] === currentDispatcher) {
      if (currentDispatcher.__hadOwn) {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: currentDispatcher.__prev,
        });
      } else {
        delete record[key];
      }
    }
  };
  listeners.set(typedListener, dispose);
  return dispose;
}

/** Each effective subscription has an identity that outlives its callback key. */
export function subscribeListener<T>(
  listeners: Map<T, Unsubscribe>,
  listener: T,
): Unsubscribe {
  const existing = listeners.get(listener);
  if (existing) return existing;
  const dispose = (): void => {
    if (listeners.get(listener) === dispose) listeners.delete(listener);
  };
  listeners.set(listener, dispose);
  return dispose;
}

/** Additions wait until the next dispatch; cancellations take effect immediately. */
export function dispatchListeners<T>(
  listeners: Map<T, Unsubscribe>,
  invoke: (listener: T) => void,
): void {
  invokeAll([...listeners].map(([listener, registration]) => () => {
    if (listeners.get(listener) === registration) invoke(listener);
  }));
}

/** Copy records and arrays at an ownership boundary; retain opaque values by reference. */
export function copyHostData<T>(
  value: T,
  seen: Map<object, unknown> = new Map(),
): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (!Array.isArray(value) && !isPlainRecord(value)) {
    return value;
  }
  const copy = Array.isArray(value)
    ? []
    : (Object.getPrototypeOf(value) === null
      ? Object.create(null)
      : {}) as Record<
        string,
        unknown
      >;
  if (Array.isArray(copy)) copy.length = (value as unknown[]).length;
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {
      value: copyHostData((value as Record<string, unknown>)[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return copy as T;
}
