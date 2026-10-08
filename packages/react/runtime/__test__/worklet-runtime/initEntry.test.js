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

    vi.resetModules();
    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBe(workletImpl);
    expect(globalThis.registerWorklet).toBe(registerWorklet);
    expect(globalThis.registerWorkletInternal).toBe(registerWorkletInternal);
    expect(globalThis.runWorklet).toBe(runWorklet);
  });
});
