// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime legacy fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__LoadLepusChunk', undefined);
    vi.stubGlobal('lynxWorkletImpl', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('exports the compatibility helper without initializing the worklet runtime', async () => {
    const reactInternal = await import('@lynx-js/react/internal');
    const bindings = await import('@lynx-js/react/worklet-runtime/bindings');

    expect(reactInternal.loadWorkletRuntime).toBeTypeOf('function');
    expect(reactInternal.loadWorkletRuntime).toBe(bindings.loadWorkletRuntime);
    expect(globalThis.lynxWorkletImpl).toBeUndefined();
  });

  it('returns false when the legacy chunk loader is unavailable', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');

    expect(loadWorkletRuntime('__Card__')).toBe(false);
  });

  it('reuses the in-memory runtime without loading the legacy chunk', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    const runtime = { _workletMap: {} };
    const loader = vi.fn();
    vi.stubGlobal('lynxWorkletImpl', runtime);
    vi.stubGlobal('__LoadLepusChunk', loader);

    expect(loadWorkletRuntime('__Card__')).toBe(true);
    expect(globalThis.lynxWorkletImpl).toBe(runtime);
    expect(loader).not.toHaveBeenCalled();
  });

  it.each([true, false])('returns the legacy chunk loader result (%s)', async (result) => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    const loader = vi.fn(() => result);
    vi.stubGlobal('__LoadLepusChunk', loader);

    expect(loadWorkletRuntime('__Card__')).toBe(result);
    expect(loader).toHaveBeenCalledExactlyOnceWith('worklet-runtime', {
      dynamicComponentEntry: '__Card__',
      chunkType: 0,
    });
  });

  it('supports callers without a dynamic component entry', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    const loader = vi.fn(() => true);
    vi.stubGlobal('__LoadLepusChunk', loader);

    expect(loadWorkletRuntime()).toBe(true);
    expect(loader).toHaveBeenCalledExactlyOnceWith('worklet-runtime', {
      dynamicComponentEntry: undefined,
      chunkType: 0,
    });
  });
});
