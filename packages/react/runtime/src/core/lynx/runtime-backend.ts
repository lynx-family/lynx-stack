// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const RUNTIME_BACKEND_SNAPSHOT = 'Snapshot';
export const RUNTIME_BACKEND_ELEMENT_TEMPLATE = 'Element Template';

export type RuntimeBackend =
  | typeof RUNTIME_BACKEND_SNAPSHOT
  | typeof RUNTIME_BACKEND_ELEMENT_TEMPLATE;

export const sRuntimeBackend = Symbol.for('__REACT_LYNX_RUNTIME_BACKEND__');

export function registerRuntimeBackend(backend: RuntimeBackend): void {
  const target = (__LEPUS__ ? globalThis : lynx) as typeof globalThis & Record<symbol, unknown>;
  const currentBackend = target[sRuntimeBackend] as RuntimeBackend | undefined;

  if (currentBackend !== undefined && currentBackend !== backend) {
    throw new Error(
      `ReactLynx runtime backend mismatch: the current template uses ${currentBackend}, but this bundle was built for ${backend}. Snapshot and Element Template templates cannot share lazy bundles. Rebuild the main template and lazy bundle with the same elementTemplate setting.`,
    );
  }

  Object.defineProperty(target, sRuntimeBackend, {
    value: backend,
    enumerable: false,
    writable: false,
    configurable: true,
  });
}
