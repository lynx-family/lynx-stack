// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  RUNTIME_BACKEND_SNAPSHOT,
  registerRuntimeBackend,
  sRuntimeBackend,
} from '../../../src/core/lynx/runtime-backend.js';

function restoreDescriptor(
  target: typeof globalThis & Record<symbol, unknown>,
  symbol: symbol,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, symbol, descriptor);
  } else {
    delete target[symbol];
  }
}

describe('runtime backend marker', () => {
  let originalLynxDescriptor: PropertyDescriptor | undefined;
  let originalGlobalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLynxDescriptor = Object.getOwnPropertyDescriptor(lynx, sRuntimeBackend);
    originalGlobalDescriptor = Object.getOwnPropertyDescriptor(globalThis, sRuntimeBackend);
    delete (lynx as typeof lynx & Record<symbol, unknown>)[sRuntimeBackend];
    delete (globalThis as typeof globalThis & Record<symbol, unknown>)[sRuntimeBackend];
    vi.stubGlobal('__LEPUS__', false);
  });

  afterEach(() => {
    restoreDescriptor(
      lynx as typeof lynx & Record<symbol, unknown>,
      sRuntimeBackend,
      originalLynxDescriptor,
    );
    restoreDescriptor(
      globalThis as typeof globalThis & Record<symbol, unknown>,
      sRuntimeBackend,
      originalGlobalDescriptor,
    );
  });

  test('registers the Snapshot backend on the background target', () => {
    registerRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT);

    expect((lynx as typeof lynx & Record<symbol, unknown>)[sRuntimeBackend]).toBe(
      RUNTIME_BACKEND_SNAPSHOT,
    );
  });

  test('registers the Element Template backend on the main-thread target', () => {
    vi.stubGlobal('__LEPUS__', true);

    registerRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

    expect((globalThis as typeof globalThis & Record<symbol, unknown>)[sRuntimeBackend]).toBe(
      RUNTIME_BACKEND_ELEMENT_TEMPLATE,
    );
  });

  test('allows registering the same backend more than once', () => {
    registerRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT);

    expect(() => registerRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT)).not.toThrow();
  });

  test('throws when Snapshot and Element Template runtimes are mixed', () => {
    registerRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT);

    expect(() => registerRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE)).toThrow(
      'Snapshot and Element Template templates cannot share lazy bundles.',
    );
  });
});
