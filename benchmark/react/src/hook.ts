// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function hook<T, K extends keyof T>(
  object: T,
  key: K,
  fn: Required<T>[K] extends (...args: infer P) => infer Q
    ? ((old?: T[K], ...args: P) => Q)
    : never,
): void {
  const oldFn = object[key];
  object[key] = function(this: T, ...args: unknown[]) {
    return fn.call(this, oldFn, ...args);
  } as T[K];
}

export const PREFIX = __REPO_FILEPATH__.split('/').slice(0, -2).join('/');

export const isMainThread = typeof __CreatePage === 'function';
