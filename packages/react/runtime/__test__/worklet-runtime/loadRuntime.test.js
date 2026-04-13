// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime legacy fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    delete globalThis.__LoadLepusChunk;
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
    globalThis.lynx = {
      ...globalThis.lynx,
      requestAnimationFrame: vi.fn(),
    };
  });

  it('should keep exposing loadWorkletRuntime from react internal exports', async () => {
    const reactInternal = await import('@lynx-js/react/internal');

    expect(reactInternal.loadWorkletRuntime).toBeTypeOf('function');
  });

  it('should return false when the legacy chunk loader is unavailable', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');

    expect(loadWorkletRuntime('__Card__')).toBe(false);
  });

  it('should reuse the in-memory runtime without calling the legacy chunk loader', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    globalThis.lynxWorkletImpl = {
      _workletMap: {},
    };
    globalThis.__LoadLepusChunk = vi.fn();

    expect(loadWorkletRuntime('__Card__')).toBe(true);
    expect(globalThis.__LoadLepusChunk).not.toBeCalled();
  });

  it('should call the legacy worklet-runtime chunk loader with the expected payload', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    globalThis.__LoadLepusChunk = vi.fn(() => true);

    expect(loadWorkletRuntime('__Card__')).toBe(true);
    expect(globalThis.__LoadLepusChunk).toBeCalledWith('worklet-runtime', {
      dynamicComponentEntry: '__Card__',
      chunkType: 0,
    });
  });

  it('should establish the legacy globals when the fallback chunk path loads the runtime', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    globalThis.__LoadLepusChunk = vi.fn(async () => {
      await import('../../src/worklet-runtime/index.ts?legacy-fallback');
      return true;
    });

    await expect(loadWorkletRuntime('__Card__')).resolves.toBe(true);
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.registerWorkletInternal).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
    expect(globalThis.lynxWorkletImpl).toBeDefined();
  });
});
