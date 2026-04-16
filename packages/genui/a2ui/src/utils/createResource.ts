// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface Resource<T = unknown> {
  id: string;
  readonly completed: boolean;
  read: () => T;
  complete: (result: T) => void;
  onUpdate: (callback: (result: T) => void) => () => void;
  promise: Promise<T>;
}

export function createResource<T = unknown>(id: string): Resource<T> {
  let resolve: (value: T) => void;
  const mockFn = new Promise<T>((_resolve) => {
    resolve = _resolve;
  });
  let status: 'pending' | 'success' | 'error' = 'pending';
  let result: T;
  let error: unknown;
  let listeners: ((data: T) => void)[] = [];

  const promise = mockFn
    .then((res) => {
      status = 'success';
      result = res;
      return res;
    })
    .catch((err) => {
      status = 'error';
      error = err;
      throw err;
    });

  return {
    id,
    promise,
    get completed() {
      return status === 'success';
    },
    read: () => {
      switch (status) {
        case 'pending':
          throw promise;
        case 'error':
          throw error;
        case 'success':
          return result;
        default:
          throw new Error('Unknown status');
      }
    },
    complete: (res: T) => {
      if (status === 'pending') {
        resolve(res);
      } else {
        result = res;
        listeners.forEach((fn) => fn(res));
      }
    },
    onUpdate: (fn: (data: T) => void) => {
      listeners.push(fn);
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },
  };
}
