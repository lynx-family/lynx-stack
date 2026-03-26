// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as runtimeLoadRuntimeModule from '../../runtime/src/worklet-runtime/bindings/loadRuntime';
import * as runtimeWorkletRuntimeModule from '../../runtime/src/worklet-runtime/workletRuntime';
import * as facadeLoadRuntimeModule from '../src/bindings/loadRuntime';
import * as facadeWorkletRuntimeModule from '../src/workletRuntime';

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
  });

  it('should expose the core worklet runtime implementation from runtime ownership', () => {
    expect(Object.keys(runtimeWorkletRuntimeModule)).toEqual(
      Object.keys(facadeWorkletRuntimeModule),
    );
  });

  it('should expose loadRuntime bindings from runtime ownership', () => {
    expect(Object.keys(runtimeLoadRuntimeModule)).toEqual(
      Object.keys(facadeLoadRuntimeModule),
    );
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
});
