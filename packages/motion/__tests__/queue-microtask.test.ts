// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe.each(
  [
    ['mini', () => import('../src/mini/polyfill.js'), false, false],
    ['full main thread', () => import('../src/polyfill/shim.js'), true, false],
    [
      'full background development',
      () => import('../src/polyfill/shim.js'),
      false,
      true,
    ],
  ] as const,
)('%s scheduler', (name, load, mainThread, dev) => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__MAIN_THREAD__', mainThread);
    vi.stubGlobal('__DEV__', dev);
    // Keep the full adapter's unrelated DOM shims from changing the test host.
    vi.stubGlobal('document', {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
    });
    vi.stubGlobal('window', { getComputedStyle: vi.fn() });
    vi.stubGlobal('NodeList', class {});
    vi.stubGlobal('SVGElement', class {});
    vi.stubGlobal('HTMLElement', class {});
    vi.stubGlobal('Element', class {});
    vi.stubGlobal('EventTarget', class {});
    vi.stubGlobal('getComputedStyle', vi.fn());
    vi.stubGlobal('SystemInfo', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each(['missing', 'native alias'] as const)(
    'preserves the native receiver when the global is %s',
    async (host) => {
      const pending: (() => void)[] = [];
      const native = {
        queueMicrotask: (callback: () => void) => pending.push(callback),
      };
      const runtime = {
        getNativeLynx() {
          expect(this).toBe(runtime);
          return native;
        },
        queueMicrotask(callback: () => void) {
          this.getNativeLynx().queueMicrotask(callback);
        },
      };
      vi.stubGlobal('lynx', runtime);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const detachedNative = runtime.queueMicrotask;
      expect(() => detachedNative(vi.fn())).toThrow(TypeError);
      vi.stubGlobal(
        'queueMicrotask',
        host === 'native alias' ? detachedNative : undefined,
      );

      await load();

      // Preact and motion-dom both capture and invoke the scheduler detached.
      const schedule = globalThis.queueMicrotask;
      const called: number[] = [];
      schedule(() => {
        called.push(1);
        schedule(() => called.push(3));
      });
      schedule(() => called.push(2));
      expect(called).toEqual([]);
      while (pending.length) pending.shift()?.();
      expect(called).toEqual([1, 2, 3]);

      vi.resetModules();
      await load();
      expect(globalThis.queueMicrotask).toBe(schedule);

      // Loading the other adapter must preserve the already-safe wrapper too.
      vi.stubGlobal('__DEV__', true);
      if (name === 'mini') await import('../src/polyfill/shim.js');
      else await import('../src/mini/polyfill.js');
      expect(globalThis.queueMicrotask).toBe(schedule);
    },
  );

  test.each([true, false])(
    'preserves an existing scheduler with Lynx present: %s',
    async (hasLynx) => {
      const schedule = vi.fn();
      vi.stubGlobal('queueMicrotask', schedule);
      vi.stubGlobal('lynx', hasLynx ? { queueMicrotask: vi.fn() } : undefined);

      await load();

      expect(globalThis.queueMicrotask).toBe(schedule);
    },
  );

  test.each([true, false])(
    'falls back to Promise with Lynx present: %s',
    async (hasLynx) => {
      vi.stubGlobal('queueMicrotask', undefined);
      vi.stubGlobal('lynx', hasLynx ? {} : undefined);

      await load();

      const callback = vi.fn();
      const schedule = globalThis.queueMicrotask;
      schedule(callback);
      expect(callback).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(callback).toHaveBeenCalledOnce();
    },
  );

  test('surfaces Promise fallback exceptions as an asynchronous error', async () => {
    vi.stubGlobal('queueMicrotask', undefined);
    vi.stubGlobal('lynx', undefined);

    await load();

    const setTimeout = vi.fn();
    vi.stubGlobal('setTimeout', setTimeout);
    const error = new Error('microtask failure');
    const schedule = globalThis.queueMicrotask;
    schedule(() => {
      throw error;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
    const rethrow = setTimeout.mock.calls[0]?.[0] as () => void;
    expect(rethrow).toThrow(error);
  });
});
