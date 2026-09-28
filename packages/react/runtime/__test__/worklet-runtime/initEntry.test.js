// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime init entry', () => {
  let originalLynx;
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalLynx = globalThis.lynx;
    originalSetTimeout = globalThis.setTimeout;
    originalSetInterval = globalThis.setInterval;
    originalClearTimeout = globalThis.clearTimeout;
    originalClearInterval = globalThis.clearInterval;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    vi.resetModules();
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
    globalThis.lynx = {
      ...originalLynx,
      setTimeout: originalSetTimeout,
      setInterval: originalSetInterval,
      clearTimeout: originalClearTimeout,
      clearInterval: originalClearInterval,
      requestAnimationFrame: originalRequestAnimationFrame,
      cancelAnimationFrame: originalCancelAnimationFrame,
    };
  });

  afterEach(() => {
    globalThis.lynx = originalLynx;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.clearInterval = originalClearInterval;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    delete globalThis.__GetPageElement;
    delete globalThis.__QuerySelector;
    delete globalThis.__QuerySelectorAll;
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
  });

  it('initializes the main-thread runtime through the public entry', async () => {
    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.registerWorkletInternal).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });

  it('does not replace a runtime that is already initialized', async () => {
    await import('@lynx-js/react/worklet-runtime/init');

    const workletImpl = globalThis.lynxWorkletImpl;
    const registerWorklet = globalThis.registerWorklet;
    const registerWorkletInternal = globalThis.registerWorkletInternal;
    const runWorklet = globalThis.runWorklet;

    await import('../../src/worklet-runtime/index.ts?repeat-init');

    expect(globalThis.lynxWorkletImpl).toBe(workletImpl);
    expect(globalThis.registerWorklet).toBe(registerWorklet);
    expect(globalThis.registerWorkletInternal).toBe(registerWorkletInternal);
    expect(globalThis.runWorklet).toBe(runWorklet);
  });

  it.each([
    ['querySelector', 'querySelectorAll'],
    ['querySelectorAll', 'querySelector'],
  ])('fills %s while preserving the host %s', async (missing, provided) => {
    const hostSelector = vi.fn(() => 'host-result');
    globalThis.lynx[provided] = hostSelector;
    delete globalThis.lynx[missing];
    globalThis.__GetPageElement = vi.fn(() => 'page-element');
    globalThis.__QuerySelector = vi.fn(() => 'mock-element');
    globalThis.__QuerySelectorAll = vi.fn(() => ['mock-element']);

    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynx[provided]).toBe(hostSelector);
    expect(globalThis.lynx[provided]('#host')).toBe('host-result');
    expect(hostSelector).toHaveBeenCalledWith('#host');
    const result = globalThis.lynx[missing]('#test-id');
    expect(result).toEqual(
      missing === 'querySelector'
        ? expect.objectContaining({ element: 'mock-element' })
        : [expect.objectContaining({ element: 'mock-element' })],
    );
    const nativeSelector = missing === 'querySelector'
      ? globalThis.__QuerySelector
      : globalThis.__QuerySelectorAll;
    expect(nativeSelector).toHaveBeenCalledWith('page-element', '#test-id', {});
  });

  it('fills selector APIs without replacing a runtime supplied by the host', async () => {
    const existingWorkletImpl = { marker: 'host-runtime' };
    const existingRegisterWorklet = vi.fn();
    const existingRegisterWorkletInternal = vi.fn();
    const existingRunWorklet = vi.fn();
    const jsContext = globalThis.lynx.getJSContext();
    jsContext.addEventListener.mockClear();
    globalThis.lynxWorkletImpl = existingWorkletImpl;
    globalThis.registerWorklet = existingRegisterWorklet;
    globalThis.registerWorkletInternal = existingRegisterWorkletInternal;
    globalThis.runWorklet = existingRunWorklet;
    delete globalThis.lynx.querySelector;
    delete globalThis.lynx.querySelectorAll;
    globalThis.__GetPageElement = vi.fn(() => 'page-element');
    globalThis.__QuerySelectorAll = vi.fn(() => ['mock-element']);

    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBe(existingWorkletImpl);
    expect(globalThis.registerWorklet).toBe(existingRegisterWorklet);
    expect(globalThis.registerWorkletInternal).toBe(existingRegisterWorkletInternal);
    expect(globalThis.runWorklet).toBe(existingRunWorklet);
    expect(jsContext.addEventListener).not.toHaveBeenCalled();
    expect(globalThis.lynx.querySelector).toBeTypeOf('function');
    expect(globalThis.lynx.querySelectorAll).toBeTypeOf('function');
    expect(globalThis.lynx.querySelectorAll('#test-id')).toEqual([
      expect.objectContaining({ element: 'mock-element' }),
    ]);
    expect(globalThis.__QuerySelectorAll).toHaveBeenCalledWith(
      'page-element',
      '#test-id',
      {},
    );
  });
});
