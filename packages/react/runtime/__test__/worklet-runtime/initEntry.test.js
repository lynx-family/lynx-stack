// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime init entry', () => {
  let originalLynx;
  let originalSystemInfo;
  let jsContext;
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalLynx = globalThis.lynx;
    originalSystemInfo = globalThis.SystemInfo;
    jsContext = { addEventListener: vi.fn() };
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
      getJSContext: () => jsContext,
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
    globalThis.SystemInfo = originalSystemInfo;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.clearInterval = originalClearInterval;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
  });

  it('initializes the main-thread runtime through the public entry', async () => {
    const { registerWorklet } = await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.registerWorkletInternal).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
    expect(registerWorklet).toBe(globalThis.registerWorkletInternal);

    const worklet = vi.fn(value => value + 1);
    registerWorklet('main-thread', 'cold-entry', worklet);
    expect(globalThis.lynxWorkletImpl._workletMap['cold-entry']).toBe(worklet);
    expect(globalThis.runWorklet({ _wkltId: 'cold-entry' }, [41])).toBe(42);
  });

  it('preserves runtime state when the init entry is evaluated again', async () => {
    const initialEntry = await import('@lynx-js/react/worklet-runtime/init');
    expect(initialEntry.registerWorklet).toBe(globalThis.registerWorkletInternal);

    const workletImpl = globalThis.lynxWorkletImpl;
    const registerWorklet = globalThis.registerWorklet;
    const registerWorkletInternal = vi.fn(globalThis.registerWorkletInternal);
    globalThis.registerWorkletInternal = registerWorkletInternal;
    const runWorklet = globalThis.runWorklet;
    const existingWorklet = vi.fn();
    registerWorklet('main-thread', 'existing', existingWorklet);
    expect(jsContext.addEventListener).toHaveBeenCalled();
    jsContext.addEventListener.mockClear();

    vi.resetModules();
    const entry = await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBe(workletImpl);
    expect(globalThis.registerWorklet).toBe(registerWorklet);
    expect(globalThis.registerWorkletInternal).toBe(registerWorkletInternal);
    expect(globalThis.runWorklet).toBe(runWorklet);
    expect(jsContext.addEventListener).not.toHaveBeenCalled();
    expect(entry.registerWorklet).toBe(registerWorkletInternal);

    const worklet = vi.fn(() => 42);
    entry.registerWorklet('main-thread', 'warm-entry', worklet);
    expect(registerWorkletInternal).toHaveBeenCalledWith('main-thread', 'warm-entry', worklet);
    expect(workletImpl._workletMap.existing).toBe(existingWorklet);
    expect(workletImpl._workletMap['warm-entry']).toBe(worklet);
    expect(runWorklet({ _wkltId: 'warm-entry' }, [])).toBe(42);
  });
});
