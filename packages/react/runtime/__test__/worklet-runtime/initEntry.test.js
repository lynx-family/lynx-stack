// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime init entry', () => {
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalSetTimeout = globalThis.setTimeout;
    originalSetInterval = globalThis.setInterval;
    originalClearTimeout = globalThis.clearTimeout;
    originalClearInterval = globalThis.clearInterval;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  });

  beforeEach(() => {
    vi.resetModules();
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
    globalThis.lynx = {
      ...globalThis.lynx,
      requestAnimationFrame: vi.fn(),
    };
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.clearInterval = originalClearInterval;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('should initialize main-thread worklet globals through the public init entry', async () => {
    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.registerWorkletInternal).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });

  it('should skip re-initialization when the runtime source executes again', async () => {
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

  it('should preserve host timers when the lynx timer APIs are unavailable', async () => {
    globalThis.lynx = {
      ...globalThis.lynx,
      requestAnimationFrame: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      cancelAnimationFrame: undefined,
    };

    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.setTimeout).toBe(originalSetTimeout);
    expect(globalThis.setInterval).toBe(originalSetInterval);
    expect(globalThis.clearTimeout).toBe(originalClearTimeout);
    expect(globalThis.clearInterval).toBe(originalClearInterval);
    expect(globalThis.requestAnimationFrame).toBe(originalRequestAnimationFrame);
    expect(globalThis.cancelAnimationFrame).toBe(originalCancelAnimationFrame);
  });
});
