// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadWorkletRuntime } from '../../runtime/src/worklet-runtime/bindings/loadRuntime';
import { ensureHostWorkletRuntime } from '../../runtime/src/worklet-runtime/host';
import * as runtimeWorkletRuntimeModule from '../../runtime/src/worklet-runtime/workletRuntime';

describe('source ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    globalThis.lynx = {
      clearInterval,
      clearTimeout,
      getJSContext: vi.fn(() => ({
        addEventListener: vi.fn(),
      })),
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
      setInterval,
      setTimeout,
    };
  });

  afterEach(() => {
    delete globalThis.lynxWorkletImpl;
    delete globalThis.registerWorklet;
    delete globalThis.registerWorkletInternal;
    delete globalThis.runWorklet;
    delete globalThis.__LoadLepusChunk;
  });

  it('should expose the core worklet runtime implementation from runtime ownership', () => {
    expect(runtimeWorkletRuntimeModule.initWorklet).toBeTypeOf('function');
  });

  it('should initialize the runtime-owned top-level entry', async () => {
    expect(globalThis.lynxWorkletImpl).toBeUndefined();

    await import('../../runtime/src/worklet-runtime/index');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });

  it('should keep the legacy package top-level entry as a working facade', async () => {
    expect(globalThis.lynxWorkletImpl).toBeUndefined();

    await import('../src/index');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });

  it('should expose a host-owned runtime capability that initializes the shared runtime state', () => {
    expect(globalThis.lynxWorkletImpl).toBeUndefined();

    expect(ensureHostWorkletRuntime()).toBe(true);

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });

  it('should preserve the legacy false return when chunk loading is unavailable', () => {
    expect(globalThis.__LoadLepusChunk).toBeUndefined();

    expect(loadWorkletRuntime('legacy://schema')).toBe(false);
  });

  it('should preserve the legacy chunk-load path when lynxWorkletImpl is only a falsy placeholder', () => {
    globalThis.lynxWorkletImpl = null;
    globalThis.__LoadLepusChunk = vi.fn(() => false);

    expect(loadWorkletRuntime('legacy://schema')).toBe(false);
    expect(globalThis.__LoadLepusChunk).toHaveBeenCalledWith('worklet-runtime', {
      dynamicComponentEntry: 'legacy://schema',
      chunkType: 0,
    });
  });

  it('should let legacy loadWorkletRuntime short-circuit once the host-owned runtime is ready', () => {
    globalThis.__LoadLepusChunk = vi.fn(() => false);

    expect(loadWorkletRuntime('legacy://schema')).toBe(false);
    expect(globalThis.__LoadLepusChunk).toHaveBeenCalledWith('worklet-runtime', {
      dynamicComponentEntry: 'legacy://schema',
      chunkType: 0,
    });

    vi.mocked(globalThis.__LoadLepusChunk).mockClear();
    ensureHostWorkletRuntime();

    expect(loadWorkletRuntime('legacy://schema')).toBe(true);
    expect(globalThis.__LoadLepusChunk).not.toHaveBeenCalled();
  });

  it('should report success for legacy loadWorkletRuntime when the host runtime is ready even without chunk loader', () => {
    expect(globalThis.__LoadLepusChunk).toBeUndefined();

    ensureHostWorkletRuntime();

    expect(loadWorkletRuntime('legacy://schema')).toBe(true);
  });
});
