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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Run teardown/cleanup callbacks so an earlier failure never skips remaining
 * destruction hooks or host listener cleanup, then rethrow the first error.
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
  for (const [listener, registration] of [...listeners]) {
    if (listeners.get(listener) === registration) {
      invoke(listener);
    }
  }
}

/** Copy plain records and arrays at an ownership boundary; retain opaque values by reference. */
export function copyHostData<T>(value: T): T {
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => copyHostData(item)) as T;
  }
  if (!isPlainRecord(value)) {
    return value;
  }
  const copy = (
    Object.getPrototypeOf(value) === null ? Object.create(null) : {}
  ) as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    const copiedValue = copyHostData(value[key]);
    if (key === '__proto__') {
      Object.defineProperty(copy, key, {
        value: copiedValue,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      copy[key] = copiedValue;
    }
  }
  return copy as T;
}
