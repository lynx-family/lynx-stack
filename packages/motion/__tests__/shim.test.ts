// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, test, vi } from 'vitest';

const names = [
  'window',
  'document',
  'Element',
  'HTMLElement',
  'SVGElement',
  'NodeList',
  'EventTarget',
  'getComputedStyle',
  'performance',
  'queueMicrotask',
] as const;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Private Motion runtime', () => {
  test('imports without installing missing globals', async () => {
    for (const name of names) vi.stubGlobal(name, undefined);
    const runtime = await import('../src/polyfill/runtime.js');
    const { ElementCompt } = await import('../src/polyfill/element.js');

    expect(runtime.Element).toBe(ElementCompt);
    expect(runtime.HTMLElement).toBe(ElementCompt);
    expect(runtime.EventTarget).toBe(ElementCompt);
    expect(runtime.performance.now()).toBeGreaterThanOrEqual(0);
    for (const name of names) expect(globalThis[name]).toBeUndefined();
  });

  test('preserves browser globals while using Lynx constructors', async () => {
    const before = names.map(name =>
      Object.getOwnPropertyDescriptor(globalThis, name)
    );
    const runtime = await import('../src/polyfill/runtime.js');
    const { ElementCompt } = await import('../src/polyfill/element.js');

    expect(runtime.Element).toBe(ElementCompt);
    expect(runtime.window.getComputedStyle).toBe(runtime.getComputedStyle);
    expect(names.map(name => Object.getOwnPropertyDescriptor(globalThis, name)))
      .toEqual(before);
  });

  test('resolves selectors to the same wrapper used by instanceof checks', async () => {
    const element = { setStyleProperty: vi.fn() };
    vi.stubGlobal('lynx', {
      querySelector: vi.fn(() => element),
      querySelectorAll: vi.fn(() => [element]),
    });
    const runtime = await import('../src/polyfill/runtime.js');
    expect(runtime.document.querySelector('.item')).toBeInstanceOf(
      runtime.Element,
    );
    expect(runtime.document.querySelectorAll('.item')[0]).toBeInstanceOf(
      runtime.EventTarget,
    );
    expect(lynx.querySelectorAll).toHaveBeenCalledWith('.item');
  });

  test('returns null for a missing Lynx selector', async () => {
    vi.stubGlobal('lynx', { querySelector: vi.fn(() => null) });
    const { document } = await import('../src/polyfill/dom.js');
    expect(document.querySelector('.missing')).toBeNull();
  });

  test('uses the host animation-frame pair with its receiver', async () => {
    const callback = vi.fn();
    const request = vi.fn(function(this: unknown, cb: typeof callback) {
      expect(this).toBe(globalThis);
      expect(cb).toBe(callback);
      return 42;
    });
    const cancel = vi.fn(function(this: unknown, handle: number) {
      expect(this).toBe(globalThis);
      expect(handle).toBe(42);
    });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const runtime = await import('../src/polyfill/animationFrame.js');

    const handle = runtime.requestAnimationFrame(callback);
    runtime.cancelAnimationFrame(handle);
    expect(request).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  test.each(['neither', 'request only', 'cancel only'])(
    'uses cancellable timers when the host provides %s frame methods',
    async (mode) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const hostRequest = vi.fn();
      const hostCancel = vi.fn();
      vi.stubGlobal(
        'requestAnimationFrame',
        mode === 'request only' ? hostRequest : undefined,
      );
      vi.stubGlobal(
        'cancelAnimationFrame',
        mode === 'cancel only' ? hostCancel : undefined,
      );
      vi.stubGlobal('performance', { now: () => 123 });
      const runtime = await import('../src/polyfill/animationFrame.js');
      const cancelled = vi.fn();
      const delivered = vi.fn();

      runtime.cancelAnimationFrame(runtime.requestAnimationFrame(cancelled));
      runtime.requestAnimationFrame(delivered);
      vi.advanceTimersByTime(15);
      expect(delivered).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(delivered).toHaveBeenCalledExactlyOnceWith(123);
      expect(cancelled).not.toHaveBeenCalled();
      expect(hostRequest).not.toHaveBeenCalled();
      expect(hostCancel).not.toHaveBeenCalled();
    },
  );
});
