// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime legacy fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.__LoadLepusChunk;
    delete globalThis.lynxWorkletImpl;
  });

  afterEach(() => {
    delete globalThis.__LoadLepusChunk;
    delete globalThis.lynxWorkletImpl;
  });

  it('keeps loadWorkletRuntime in the internal exports', async () => {
    const reactInternal = await import('@lynx-js/react/internal');

    expect(reactInternal.loadWorkletRuntime).toBeTypeOf('function');
  });

  it('returns false when the legacy chunk loader is unavailable', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');

    expect(loadWorkletRuntime('__Card__')).toBe(false);
  });

  it('reuses the in-memory runtime without loading the legacy chunk', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    globalThis.lynxWorkletImpl = {
      _workletMap: {},
    };
    globalThis.__LoadLepusChunk = vi.fn();

    expect(loadWorkletRuntime('__Card__')).toBe(true);
    expect(globalThis.__LoadLepusChunk).not.toHaveBeenCalled();
  });

  it('passes the legacy payload to the worklet-runtime chunk loader', async () => {
    const { loadWorkletRuntime } = await import('@lynx-js/react/internal');
    globalThis.__LoadLepusChunk = vi.fn(() => true);

    expect(loadWorkletRuntime('__Card__')).toBe(true);
    expect(globalThis.__LoadLepusChunk).toHaveBeenCalledWith(
      'worklet-runtime',
      {
        dynamicComponentEntry: '__Card__',
        chunkType: 0,
      },
    );
  });
});
