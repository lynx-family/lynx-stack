// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

let mainThreadObjectHandleTypes: WeakMap<object, string> | undefined;

export function registerMainThreadObjectHandle(
  handle: object,
  type: string,
): void {
  (mainThreadObjectHandleTypes ??= new WeakMap()).set(handle, type);
}

export function isMainThreadObjectHandle(value: unknown): value is object {
  return typeof value === 'object' && value !== null
    && mainThreadObjectHandleTypes?.has(value) === true;
}

export function getMainThreadObjectHandleType(
  value: unknown,
): string | undefined {
  return typeof value === 'object' && value !== null
    ? mainThreadObjectHandleTypes?.get(value)
    : undefined;
}
