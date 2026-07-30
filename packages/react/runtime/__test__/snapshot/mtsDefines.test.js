// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  delete globalThis.__initMTSDefines;
});

async function importMTSDefines() {
  await import('../../mts-rendering-disabled/index.js');
}

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
    globalThis.__initMTSDefines = defines;

    await importMTSDefines();

    expect(defines).toHaveBeenCalledTimes(1);
    const [runtime] = defines.mock.calls[0];
    for (const [member, type] of Object.entries(PROVIDED_MEMBERS)) {
      expect(runtime[member], member).toBeTypeOf(type);
    }
  });

  it('reads `__pageId` through a getter, so definitions see the current page', async () => {
    const defines = vi.fn();
    globalThis.__initMTSDefines = defines;

    await importMTSDefines();
    // `vi.resetModules()` gives each test a fresh module graph; read the page
    // setup from the same graph the entry closed over.
    const [{ setupPage }, definition] = await Promise.all([
      import('../../src/snapshot'),
      import('../../src/snapshot/snapshot/definition'),
    ]);

    const [runtime] = defines.mock.calls[0];
    setupPage(__CreatePage('0', 0));
    expect(runtime.__pageId).toBe(definition.__pageId);
  });

  it('reaches for no bundler internal, so a non-webpack pipeline can supply the one binding it needs', () => {
    const source = readFileSync(
      new URL('../../mts-rendering-disabled/index.js', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('__webpack_require__');
  });

  it('does nothing when the bundle has no definitions', async () => {
    await expect(importMTSDefines()).resolves.not.toThrow();
  });
});

describe('root fallback', () => {
  it('renders the fallback the defines name as the pre-hydration root content', async () => {
    globalThis.__initMTSDefines = (runtime) => {
      runtime.snapshotCreatorMap['__snapshot_test_fallback_1'] = (id) =>
        runtime.createSnapshot(
          id,
          () => [__CreateView(runtime.__pageId)],
          null,
          [],
          undefined,
          undefined,
          null,
          true,
        );
      if (typeof runtime.__setRootMTSFallback === 'function') {
        runtime.__setRootMTSFallback('__snapshot_test_fallback_1');
      }
    };

    await importMTSDefines();

    const { __root } = await import('../../src/root');
    expect(__root.childNodes).toHaveLength(1);
    expect(__root.childNodes[0].type).toBe('__snapshot_test_fallback_1');
  });

  it('keeps the first declared fallback when a stray second one arrives', async () => {
    globalThis.__initMTSDefines = (runtime) => {
      const creator = (id) =>
        runtime.createSnapshot(
          id,
          () => [__CreateView(runtime.__pageId)],
          null,
          [],
          undefined,
          undefined,
          null,
          true,
        );
      runtime.snapshotCreatorMap['__snapshot_first_1'] = creator;
      runtime.snapshotCreatorMap['__snapshot_second_1'] = creator;
      runtime.__setRootMTSFallback('__snapshot_first_1');
      runtime.__setRootMTSFallback('__snapshot_second_1');
    };

    await importMTSDefines();

    const { __root } = await import('../../src/root');
    expect(__root.childNodes.map((node) => node.type)).toEqual([
      '__snapshot_first_1',
    ]);
  });

  it('degrades to an empty root when the named definition is missing', async () => {
    globalThis.__initMTSDefines = (runtime) => {
      runtime.__setRootMTSFallback('__snapshot_not_generated_1');
    };

    await importMTSDefines();

    const { __root } = await import('../../src/root');
    expect(__root.childNodes).toHaveLength(0);
  });
});
