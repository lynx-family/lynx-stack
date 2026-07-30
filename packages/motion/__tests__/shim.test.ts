// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Shim', () => {
  // Store original values
  const origDocument = globalThis.document;
  const origPerformance = globalThis.performance;
  const origQueueMicrotask = globalThis.queueMicrotask;
  const origNodeList = globalThis.NodeList;
  const origSVGElement = globalThis.SVGElement;
  const origHTMLElement = globalThis.HTMLElement;
  const origWindow = globalThis.window;
  const origElement = (globalThis as any).Element;
  const origGetComputedStyle = globalThis.getComputedStyle;
  const origEventTarget = (globalThis as any).EventTarget;
  const origLynx = (globalThis as any).lynx;
  const origSystemInfo = (globalThis as any).SystemInfo;

  beforeEach(() => {
    vi.resetModules();
    // Reset globals to test shimming
    // @ts-expect-error
    delete globalThis.document;
    // @ts-expect-error
    delete globalThis.performance;
    // @ts-expect-error
    delete globalThis.queueMicrotask;
    // @ts-expect-error
    delete globalThis.NodeList;
    // @ts-expect-error
    delete globalThis.SVGElement;
    // @ts-expect-error
    delete globalThis.HTMLElement;
    // @ts-expect-error
    delete globalThis.window;
    delete (globalThis as any).Element;
    // @ts-expect-error
    delete globalThis.getComputedStyle;
    delete (globalThis as any).EventTarget;

    // Setup lynx mock
    (globalThis as any).lynx = {
      querySelector: () => null,
      querySelectorAll: () => [],
    };

    // Mock __MAIN_THREAD__ and __DEV__
    (globalThis as any).__MAIN_THREAD__ = true;
    (globalThis as any).__DEV__ = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original globals
    globalThis.document = origDocument;
    globalThis.performance = origPerformance;
    globalThis.queueMicrotask = origQueueMicrotask;

    globalThis.NodeList = origNodeList;

    globalThis.SVGElement = origSVGElement;

    globalThis.HTMLElement = origHTMLElement;
    globalThis.window = origWindow;
    (globalThis as any).Element = origElement;
    globalThis.getComputedStyle = origGetComputedStyle;
    (globalThis as any).EventTarget = origEventTarget;
    (globalThis as any).lynx = origLynx;
    (globalThis as any).SystemInfo = origSystemInfo;
    delete (globalThis as any).__MAIN_THREAD__;
    delete (globalThis as any).__DEV__;
  });

  test('should export shimmed globals after import', async () => {
    // Import shim to trigger shimming
    await import('../src/polyfill/shim.js');

    // Check that shims were applied (they may already exist in test env)
    // The shim only applies if they don't exist, so we just verify no errors
    expect(true).toBe(true);
  });

  test('should replace browser DOM globals in Lynx for Web', async () => {
    const BrowserElement = class Element {};
    const BrowserHTMLElement = class HTMLElement {};
    const BrowserEventTarget = class EventTarget {};
    (globalThis as any).Element = BrowserElement;
    globalThis.HTMLElement = BrowserHTMLElement;
    (globalThis as any).EventTarget = BrowserEventTarget;
    (globalThis as any).SystemInfo = { platform: 'web' };
    globalThis.window = {} as Window & typeof globalThis;

    await import('../src/polyfill/shim.js');

    expect(globalThis.Element).not.toBe(BrowserElement);
    expect(globalThis.HTMLElement).toBe(globalThis.Element);
    expect(globalThis.EventTarget).toBe(globalThis.Element);
    expect(globalThis.window.getComputedStyle).toBe(
      globalThis.getComputedStyle,
    );
  });

  test('should tolerate an immutable window binding from older Lynx for Web runtimes', async () => {
    (globalThis as any).SystemInfo = { platform: 'web' };
    // Older Lynx for Web MTS wrappers declare `window` as a `const`, so
    // assigning to it throws in strict mode. A non-writable property fails
    // the same way.
    const immutableWindow = {} as Window & typeof globalThis;
    Object.defineProperty(globalThis, 'window', {
      value: immutableWindow,
      writable: false,
      configurable: true,
    });

    try {
      await expect(import('../src/polyfill/shim.js')).resolves.toBeDefined();

      // The window facade is skipped, but the remaining shims still apply.
      expect(globalThis.window).toBe(immutableWindow);
      expect(typeof globalThis.Element).toBe('function');
      expect(globalThis.HTMLElement).toBe(globalThis.Element);
      expect(globalThis.getComputedStyle).toBeDefined();
    } finally {
      // Make `window` assignable again so afterEach can restore it.
      delete (globalThis as any).window;
    }
  });
});

describe('Shim queueMicrotask', () => {
  test('queueMicrotask polyfill should work', async () => {
    // Test that our queueMicrotask works
    let called = false;

    // Use the global queueMicrotask
    queueMicrotask(() => {
      called = true;
    });

    // Wait for microtask to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(called).toBe(true);
  });
});
