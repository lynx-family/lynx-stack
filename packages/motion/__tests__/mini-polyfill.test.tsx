// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';
import { animate, createMotionValue } from '../src/mini/index.js';

describe('Mini Polyfill Independence', () => {
  test('should work in main thread environment', async () => {
    let result = null;

    const App = () => {
      useEffect(() => {
        runOnMainThread(() => {
          'main thread';
          try {
            const mv = createMotionValue(0);

            // Should not throw
            if (mv.get() !== 0) throw new Error('Initial value wrong');

            // Animate
            animate(mv, 100, {
              duration: 0.1,
              onComplete: () => {
                'main thread';
                // This will run async
              },
            });

            // If we got here without crashing (e.g. from missing globals), success-ish
            return 'success';
          } catch (e) {
            return (e as Error).message;
          }
        })().then(res => {
          result = res;
        });
      }, []);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result).toBe('success');
  });
});

describe('Polyfill Unit Logic', () => {
  let originalQueueMicrotask: typeof queueMicrotask;
  // biome-ignore lint/suspicious/noExplicitAny: mock globals
  let originalLynx: any;

  beforeEach(() => {
    vi.resetModules();
    originalQueueMicrotask = globalThis.queueMicrotask;
    originalLynx = globalThis.lynx;
  });

  afterEach(() => {
    globalThis.queueMicrotask = originalQueueMicrotask;
    (globalThis as any).lynx = originalLynx;
    vi.restoreAllMocks();
  });

  test('should use existing queueMicrotask if available', async () => {
    const mockQM = vi.fn();
    globalThis.queueMicrotask = mockQM;

    await import('../src/mini/polyfill.js');

    expect(globalThis.queueMicrotask).toBe(mockQM);
  });

  test('should use lynx.queueMicrotask if global is missing', async () => {
    delete (globalThis as any).queueMicrotask;
    const mockQM = vi.fn();
    (globalThis as any).lynx = { queueMicrotask: mockQM };

    await import('../src/mini/polyfill.js');

    expect(globalThis.queueMicrotask).toBe(mockQM);
  });

  test('should fallback to promise-based polyfill if both missing', async () => {
    delete (globalThis as any).queueMicrotask;
    delete (globalThis as any).lynx;

    await import('../src/mini/polyfill.js');

    expect(globalThis.queueMicrotask).toBeDefined();
    expect(globalThis.queueMicrotask).not.toBe(originalQueueMicrotask);

    const fn = vi.fn();
    globalThis.queueMicrotask(fn);

    expect(fn).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(fn).toHaveBeenCalled();
  });

  test('fallback should rethrow errors via setTimeout', async () => {
    delete (globalThis as any).queueMicrotask;
    delete (globalThis as any).lynx;

    await import('../src/mini/polyfill.js');

    const error = new Error('test error');
    const fn = vi.fn().mockImplementation(() => {
      throw error;
    });
    // Prevent actual throw from crashing test
    // biome-ignore lint/suspicious/noExplicitAny: mock
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((cb) => {
        try {
          if (typeof cb === 'function') (cb as Function)();
        } catch {
          // ignore
        }
        return 0 as any;
      });

    globalThis.queueMicrotask(fn);

    // Wait enough ticks
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});
