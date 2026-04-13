// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sExportsReactInternal = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)',
);

describe('lazy internal compatibility bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__LEPUS__', true);
    globalThis.lynx = {};
    delete globalThis[sExportsReactInternal];
  });

  afterEach(() => {
    delete globalThis[sExportsReactInternal];
    vi.unstubAllGlobals();
  });

  it('should expose the host loadWorkletRuntime to historical lazy bundles', async () => {
    const hostLoadWorkletRuntime = vi.fn();
    globalThis[sExportsReactInternal] = {
      loadWorkletRuntime: hostLoadWorkletRuntime,
      snapshotCreatorMap: {},
    };

    const lazyInternal = await import('../../lazy/internal.js?legacy-worklet');

    expect(lazyInternal.loadWorkletRuntime).toBe(hostLoadWorkletRuntime);
  });

  it('should surface the existing snapshotCreatorMap compatibility guard first', async () => {
    globalThis[sExportsReactInternal] = {
      loadWorkletRuntime: vi.fn(),
    };

    await expect(
      import('../../lazy/internal.js?missing-snapshot'),
    ).rejects.toThrow(/snapshotCreatorMap/);
  });
});
