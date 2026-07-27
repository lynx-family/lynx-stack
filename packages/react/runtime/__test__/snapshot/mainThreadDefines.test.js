// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupPage } from '../../src/snapshot';
import { __pageId } from '../../src/snapshot/snapshot/definition';

afterEach(() => {
  vi.resetModules();
  delete globalThis.__lynxMainThreadDefines;
  delete globalThis.__webpack_require__;
});

async function importMainThreadDefines() {
  await import('../../main-thread-defines/index.js');
}

// The members the assembled definitions call. Keep in sync with
// `PROVIDED_RUNTIME_MEMBERS` in `@lynx-js/react-webpack-plugin`.
const PROVIDED_MEMBERS = {
  __pageId: 'number',
  createSnapshot: 'function',
  snapshotCreatorMap: 'object',
  snapshotCreateList: 'function',
  updateSpread: 'function',
  updateEvent: 'function',
  updateRef: 'function',
  updateWorkletEvent: 'function',
  updateWorkletRef: 'function',
  updateGesture: 'function',
  updateListItemPlatformInfo: 'function',
  __DynamicPartSlot: 'number',
  __DynamicPartSlotV2: 'number',
  __DynamicPartSlotV2_0: 'object',
  __DynamicPartListSlotV2: 'number',
  __DynamicPartChildren: 'number',
  __DynamicPartChildren_0: 'object',
  __DynamicPartListChildren: 'number',
  loadWorkletRuntime: 'function',
};

describe('main-thread defines entry', () => {
  it('registers the definitions generated into the bundle', async () => {
    const defines = vi.fn();
    globalThis.__lynxMainThreadDefines = defines;

    await importMainThreadDefines();

    expect(defines).toHaveBeenCalledTimes(1);
    const [runtime, internalRuntime, loadWorkletRuntime, require] = defines.mock.calls[0];
    expect(internalRuntime).toBe(runtime);
    for (const [member, type] of Object.entries(PROVIDED_MEMBERS)) {
      expect(runtime[member], member).toBeTypeOf(type);
    }
    expect(loadWorkletRuntime).toBeTypeOf('function');
    // The dev creator falls back to `require`-ing the runtime.
    expect(require()).toBe(runtime);
  });

  it('reads `__pageId` through a getter, so definitions see the current page', async () => {
    const defines = vi.fn();
    globalThis.__lynxMainThreadDefines = defines;

    await importMainThreadDefines();

    const [runtime] = defines.mock.calls[0];
    setupPage(__CreatePage('0', 0));
    expect(runtime.__pageId).toBe(__pageId);
  });

  it('publishes the runtime for lazy bundle sections', async () => {
    globalThis.__lynxMainThreadDefines = vi.fn();
    globalThis.__webpack_require__ = {};

    await importMainThreadDefines();

    expect(globalThis.__webpack_require__['mtDefinesRuntime'].createSnapshot)
      .toBeTypeOf('function');
  });

  it('does nothing when the bundle has no definitions', async () => {
    await expect(importMainThreadDefines()).resolves.not.toThrow();
  });
});
