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
});
