// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('worklet-runtime init entry', () => {
  beforeEach(() => {
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

  it('should initialize main-thread worklet globals through the public init entry', async () => {
    await import('@lynx-js/react/worklet-runtime/init');

    expect(globalThis.lynxWorkletImpl).toBeDefined();
    expect(globalThis.registerWorklet).toBeTypeOf('function');
    expect(globalThis.registerWorkletInternal).toBeTypeOf('function');
    expect(globalThis.runWorklet).toBeTypeOf('function');
  });
});
