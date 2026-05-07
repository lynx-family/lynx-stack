// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type ResourceStatus = 'pending' | 'success' | 'error';

/**
 * Immutable, transition-keyed snapshot returned by
 * {@link Resource.getSnapshot}. The object reference changes on every
 * `complete()` / `fail()` call so `useSyncExternalStore` re-renders even
 * for `pending → error` transitions where `value` stays `undefined`.
 */
export interface ResourceSnapshot<T = unknown> {
  status: ResourceStatus;
  value: T | undefined;
  error: unknown;
}

export interface Resource<T = unknown> {
  id: string;
  readonly completed: boolean;
  readonly status: ResourceStatus;
  readonly value: T | undefined;
  readonly error: unknown;
  /**
   * @deprecated Read `value` / `status` directly. Retained for backwards
   * compatibility; in the success state it returns the value, otherwise it
   * returns undefined. It does not throw.
   */
  read: () => T | undefined;
  complete: (result: T) => void;
  fail: (err: unknown) => void;
  /**
   * @deprecated Use `subscribe`. Behaves identically.
   */
  onUpdate: (callback: (result: T) => void) => () => void;
  /**
   * Subscribe to state changes. The callback is invoked after every
   * `complete()` or `fail()` (the same value may be re-published when the
   * processor re-emits an update for the same id). Returns a disposer.
   */
  subscribe: (callback: () => void) => () => void;
  /**
   * Synchronous read of the current snapshot, suitable for
   * `useSyncExternalStore`. The returned object reference changes on every
   * transition.
   */
  getSnapshot: () => ResourceSnapshot<T>;
  promise: Promise<T>;
}

export function createResource<T = unknown>(id: string): Resource<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Swallow unhandled rejection — listeners may attach later.
  promise.catch(() => {
    /* deferred: callers attach via subscribe / onUpdate */
  });

  let status: ResourceStatus = 'pending';
  let value: T | undefined;
  let error: unknown;
  // Snapshot object whose reference changes on every transition so that
  // `useSyncExternalStore`'s `Object.is` bail-out doesn't miss
  // `pending → error` (where `value` stays `undefined`).
  let snapshot: ResourceSnapshot<T> = { status, value, error };
  const listeners = new Set<() => void>();

  const notify = () => {
    snapshot = { status, value, error };
    for (const fn of listeners) fn();
  };

  return {
    id,
    promise,
    get completed() {
      return status === 'success';
    },
    get status() {
      return status;
    },
    get value() {
      return value;
    },
    get error() {
      return error;
    },
    read: () => value,
    complete: (res: T) => {
      // `error` is terminal — refuse error → success transitions so
      // observers don't see `{ status: 'success', error: <stale> }`.
      if (status === 'error') return;
      const wasPending = status === 'pending';
      value = res;
      status = 'success';
      if (wasPending) resolve(res);
      notify();
    },
    fail: (err: unknown) => {
      if (status !== 'pending') return;
      error = err;
      status = 'error';
      reject(err);
      notify();
    },
    onUpdate: (fn: (data: T) => void) => {
      const wrapped = () => {
        if (value !== undefined) fn(value);
      };
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => snapshot,
  };
}
