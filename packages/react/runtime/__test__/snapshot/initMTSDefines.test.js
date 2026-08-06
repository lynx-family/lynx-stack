// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  delete globalThis.__initMTSDefines;
});

async function importInitMTSDefines() {
  await import('../../src/snapshot/snapshot/initMTSDefines.js');
}

describe('initMTSDefines', () => {
  it('registers the injected definitions with the internal runtime', async () => {
    const defines = vi.fn();
    globalThis.__initMTSDefines = defines;

    await importInitMTSDefines();

    expect(defines).toHaveBeenCalledTimes(1);
    const [runtime] = defines.mock.calls[0];
    const internal = await import('../../src/internal.js');
    expect(runtime).toBe(internal);
    expect(runtime.createSnapshot).toBeTypeOf('function');
    expect(runtime.snapshotCreatorMap).toBeTypeOf('object');
    expect(runtime.loadWorkletRuntime).toBeTypeOf('function');
  });

  it('does nothing when the bundle has no injected definitions', async () => {
    await expect(importInitMTSDefines()).resolves.not.toThrow();
  });
});
