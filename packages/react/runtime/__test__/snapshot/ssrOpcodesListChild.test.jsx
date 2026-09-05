/** @jsxImportSource ../../lepus */
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeAll, describe, expect, it } from '@rstest/core';

import { __root } from '../../src/root';
import { setupPage, SnapshotInstance } from '../../src/snapshot';
import { ssrHydrateByOpcodes } from '../../src/snapshot/renderToOpcodes/opcodes';

const HOLE = null;

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

describe('ssrHydrateByOpcodes', () => {
  it('skips list children that carry no element root', () => {
    const listType = __SNAPSHOT__(<list>{HOLE}</list>);
    const itemType = __SNAPSHOT__(
      <list-item item-key={0}>
        <text>A</text>
      </list-item>,
    );

    const listElement = __CreateElement('list', 0);
    const into = new SnapshotInstance(listType, -900);

    ssrHydrateByOpcodes(
      [
        0,
        [listType, -901, [{ ssrID: 'list' }]],
        0,
        0,
        // No SSR elements for this child, so it ends up without an element root.
        [itemType, -902, []],
        0,
        1,
        1,
      ],
      into,
      { list: listElement },
    );

    expect(into.childNodes[0].childNodes[0].__element_root).toBeUndefined();
  });
});
