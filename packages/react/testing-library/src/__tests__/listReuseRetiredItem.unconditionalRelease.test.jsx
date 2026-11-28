// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { useState } from '@lynx-js/react';

import { render } from '..';
import { gRecycleMap } from '../../../runtime/lib/snapshot/list/list.js';

let hideExtraOfItem0;

function Item({ id }) {
  const [showExtra, setShowExtra] = useState(true);
  if (id === 0) {
    hideExtraOfItem0 = () => setShowExtra(false);
  }
  return (
    <view>
      <text>{`item ${id}`}</text>
      {showExtra ? <text>extra</text> : null}
    </view>
  );
}

function List() {
  return (
    <list>
      {[0, 1, 2].map((id) => (
        <list-item key={id} item-key={id}>
          <Item id={id} />
        </list-item>
      ))}
    </list>
  );
}

function pooledItem() {
  const byType = Object.values(gRecycleMap)[0];
  const [signMap] = byType.values();
  const [ctx] = signMap.values();
  return ctx;
}

describe('list reuse if hydrate released the retired item', () => {
  it('rejects the next patch the background sends to it', async () => {
    const { container } = render(<List />);
    const list = container.firstChild;

    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    elementTree.leaveListItem(list, uid0);
    const retired = pooledItem();
    elementTree.enterListItemAtIndex(list, 1);

    // Reuse already dropped the retired item's handles; releasing it in
    // `hydrate` would unlink it as well.
    expect(retired.__element_root).toBeUndefined();
    retired.tearDown();

    let error;
    try {
      await act(() => {
        hideExtraOfItem0();
      });
    } catch (e) {
      error = e;
    }
    expect(error?.message).toBe('The node to be removed is not a child of this node.');
  });
});
