// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type ResourceStatus = 'pending' | 'success' | 'error';

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
   * Synchronous read of the current value, suitable for `useSyncExternalStore`.
   * Returns `undefined` while pending.
   */
  getSnapshot: () => T | undefined;
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
  const listeners = new Set<() => void>();

  const notify = () => {
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
    getSnapshot: () => value,
  };
}
