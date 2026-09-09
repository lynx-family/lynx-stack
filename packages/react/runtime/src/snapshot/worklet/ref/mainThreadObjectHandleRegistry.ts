// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

let mainThreadObjectHandles: WeakSet<object> | undefined;
let mainThreadObjectHandleMetadata:
  | WeakMap<
    object,
    { readonly initialValue: unknown; readonly type: string }
  >
  | undefined;

export function registerMainThreadObjectHandle(
  handle: object,
  type: string,
  initialValue: unknown,
): void {
  (mainThreadObjectHandles ??= new WeakSet()).add(handle);
  (mainThreadObjectHandleMetadata ??= new WeakMap()).set(handle, {
    initialValue,
    type,
  });
}

export function isMainThreadObjectHandle(value: unknown): value is object {
  return typeof value === 'object' && value !== null
    && mainThreadObjectHandles?.has(value) === true;
}

export function getMainThreadObjectHandleMetadata(
  value: unknown,
): { readonly initialValue: unknown; readonly type: string } | undefined {
  return typeof value === 'object' && value !== null
    ? mainThreadObjectHandleMetadata?.get(value)
    : undefined;
}
