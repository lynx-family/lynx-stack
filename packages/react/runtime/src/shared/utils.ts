// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* v8 ignore start */
export const noop: (...args: unknown[]) => unknown = () => {};
/* v8 ignore stop */

export function isEmptyObject(obj?: object): obj is Record<string, never> {
  for (const _ in obj) return false;
  return true;
}

export function maybePromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === 'object'
    && value !== null
    // @ts-expect-error the check is safe
    && typeof value.then === 'function'
  );
}

export function getDisplayName(type: { displayName?: string | undefined; name: string }): string {
  return type.displayName ?? type.name;
}

export function hook<T, K extends keyof T>(
  object: T,
  key: K,
  fn: Required<T>[K] extends (...args: infer P) => infer Q ? ((old?: T[K], ...args: P) => Q)
    : never,
): void {
  const oldFn = object[key];
  object[key] = function(this: T, ...args: unknown[]) {
    return fn.call(this, oldFn, ...args);
  } as T[K];
}
