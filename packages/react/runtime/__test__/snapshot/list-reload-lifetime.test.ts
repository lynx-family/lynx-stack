// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each(['unmount', 'native destruction'])(
  'cleans up a retained native list after entry re-evaluation: %s',
  async (action) => {
    const native = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('lynx', { ...lynx, getNative: () => native });
    const element = { id: 17 };
    vi.stubGlobal('__CreateList', vi.fn(() => element));
    vi.stubGlobal('__GetElementUniqueID', vi.fn(() => 17));
    const updateCallbacks = vi.fn();
    vi.stubGlobal('__UpdateListCallbacks', updateCallbacks);
    const oldList = await import('../../src/snapshot/snapshot/list.js');
    const oldState = await import('../../src/snapshot/list/list.js');
    oldList.snapshotCreateList(0, {} as never, 0);
    const state = oldState.captureListState();
    expect(native.addEventListener).toHaveBeenCalledOnce();
    const listener = native.addEventListener.mock.calls[0]![1] as () => void;

    // Use independent module instances, like an actual entry re-evaluation.
    vi.resetModules();
    const freshState = await import('../../src/snapshot/list/list.js');
    freshState.restoreListState(state);
    const freshList = await import('../../src/snapshot/snapshot/list.js');
    if (action === 'unmount') {
      freshList.snapshotDestroyList({
        __snapshot_def: { slot: [[0, 0]] },
        __elements: [element],
      } as never);
      expect(native.removeEventListener).toHaveBeenCalledExactlyOnceWith('__DestroyLifetime', listener);
      expect(freshState.gSignMap[17]).toBeUndefined();
      expect(freshState.gRecycleMap[17]).toBeUndefined();
    } else {
      listener();
      expect(updateCallbacks).toHaveBeenCalledExactlyOnceWith(element, null, null, null);
    }
    expect(freshState.captureListState().destroyLifetimeHandlers.size).toBe(0);
    expect(oldState.captureListState().destroyLifetimeHandlers.size).toBe(0);
  },
);
