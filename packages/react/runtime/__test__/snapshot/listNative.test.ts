// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it } from '@rstest/core';

import { snapshotCreateList, snapshotDestroyList } from '../../src/snapshot/snapshot/list';

type LynxWithNative = typeof lynx & { getNative?: unknown };

describe('snapshot list native lifetime wiring', () => {
  const lynxObj = lynx as LynxWithNative;
  const originalGetNative = lynxObj.getNative;

  afterEach(() => {
    lynxObj.getNative = originalGetNative;
  });

  function createListInstance() {
    const list = snapshotCreateList(0, {} as never, 0);
    return {
      list,
      si: {
        __snapshot_def: { slot: [[null, 0]] },
        __elements: [list],
      } as never,
    };
  }

  it('skips destroy-lifetime wiring when the native module is unavailable', () => {
    lynxObj.getNative = undefined;

    const { list, si } = createListInstance();

    expect(list).toBeDefined();
    // No handler was registered, so destroy finds nothing to remove.
    expect(() => snapshotDestroyList(si)).not.toThrow();
  });

  it('skips listener removal when the native module disappears before destroy', () => {
    const { si } = createListInstance();
    lynxObj.getNative = undefined;

    expect(() => snapshotDestroyList(si)).not.toThrow();
  });
  it('finds no handler to remove when the list was created without the native module', () => {
    lynxObj.getNative = undefined;
    const { si } = createListInstance();
    lynxObj.getNative = originalGetNative;

    expect(() => snapshotDestroyList(si)).not.toThrow();
  });
});
