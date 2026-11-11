// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getRuntimeVersion, registerRuntimeVersion, sRuntimeVersion } from '../../../src/core/lynx/runtime-version.js';

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

describe('runtime version marker', () => {
  let originalLynxDescriptor: PropertyDescriptor | undefined;
  let originalGlobalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLynxDescriptor = Object.getOwnPropertyDescriptor(lynx, sRuntimeVersion);
    originalGlobalDescriptor = Object.getOwnPropertyDescriptor(globalThis, sRuntimeVersion);
    delete (lynx as typeof lynx & Record<symbol, unknown>)[sRuntimeVersion];
    delete (globalThis as typeof globalThis & Record<symbol, unknown>)[sRuntimeVersion];
    vi.stubGlobal('__LEPUS__', false);
  });

  afterEach(() => {
    restoreDescriptor(
      lynx as typeof lynx & Record<symbol, unknown>,
      sRuntimeVersion,
      originalLynxDescriptor,
    );
    restoreDescriptor(
      globalThis as typeof globalThis & Record<symbol, unknown>,
      sRuntimeVersion,
      originalGlobalDescriptor,
    );
  });

  describe('registerRuntimeVersion', () => {
    test('records the runtime version on the background target', () => {
      registerRuntimeVersion('0.126.1');

      expect((lynx as typeof lynx & Record<symbol, unknown>)[sRuntimeVersion]).toBe(
        '0.126.1',
      );
    });

    test('records the runtime version on the main-thread target', () => {
      vi.stubGlobal('__LEPUS__', true);

      registerRuntimeVersion('0.126.1');

      expect((globalThis as typeof globalThis & Record<symbol, unknown>)[sRuntimeVersion]).toBe(
        '0.126.1',
      );
    });

    test('does nothing when the version is not stamped', () => {
      registerRuntimeVersion(undefined);

      expect(getRuntimeVersion()).toBeUndefined();
    });

    test('keeps the host version when a lazy bundle registers later', () => {
      // Host registers first.
      registerRuntimeVersion('1.2.0');

      // A later lazy bundle must not overwrite the host's recorded version.
      registerRuntimeVersion('2.0.0');
      expect(getRuntimeVersion()).toBe('1.2.0');
    });

    test('logs the runtime version into Alog on registration', () => {
      const alog = vi.fn();
      vi.stubGlobal('console', { ...console, alog });

      registerRuntimeVersion('0.126.1');

      expect(alog).toHaveBeenCalledWith(
        '[ReactLynx] new runtime version: 0.126.1',
      );
    });

    test('logs both the recorded and the incoming version for later lazy bundles', () => {
      const alog = vi.fn();
      vi.stubGlobal('console', { ...console, alog });

      registerRuntimeVersion('1.2.0');
      registerRuntimeVersion('2.0.0');

      expect(alog).toHaveBeenNthCalledWith(
        1,
        '[ReactLynx] new runtime version: 1.2.0',
      );
      expect(alog).toHaveBeenNthCalledWith(
        2,
        '[ReactLynx] new runtime version: 2.0.0, current version: 1.2.0',
      );
    });

    test('does not log when the version is not stamped', () => {
      const alog = vi.fn();
      vi.stubGlobal('console', { ...console, alog });

      registerRuntimeVersion(undefined);

      expect(alog).not.toHaveBeenCalled();
    });

    test('does not log on the main-thread build', () => {
      vi.stubGlobal('__JS__', false);
      const alog = vi.fn();
      vi.stubGlobal('console', { ...console, alog });

      registerRuntimeVersion('0.126.1');

      expect(alog).not.toHaveBeenCalled();
      // The version is still recorded so `getRuntimeVersion` keeps working.
      expect(getRuntimeVersion()).toBe('0.126.1');
    });
  });

  describe('getRuntimeVersion', () => {
    test('returns undefined before any registration', () => {
      expect(getRuntimeVersion()).toBeUndefined();
    });

    test('returns the recorded host version', () => {
      registerRuntimeVersion('0.126.1');

      expect(getRuntimeVersion()).toBe('0.126.1');
    });
  });
});
