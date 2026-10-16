// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { useState } from '@lynx-js/react';

import { render } from '..';

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

describe('list reuse and a later update to the recycled item', () => {
  it('the background still patches the retired node after native reused it', async () => {
    const { container } = render(<List />);
    const list = container.firstChild;

    // Native shows item 0, scrolls it away, then asks for item 1: item 1 is
    // served by reusing item 0's elements.
    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    elementTree.leaveListItem(list, uid0);
    elementTree.enterListItemAtIndex(list, 1);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_ed4fb_test_4","item-key":0},{"position":1,"type":"__snapshot_ed4fb_test_4","item-key":1},{"position":2,"type":"__snapshot_ed4fb_test_4","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="1"
          >
            <view>
              <text>
                item 1
              </text>
              <wrapper>
                <text>
                  extra
                </text>
              </wrapper>
            </view>
          </list-item>
        </list>
      </page>
    `);

    // Item 0's component is still mounted on the background. A state change
    // there removes a child of the node native has already retired.
    await act(() => {
      hideExtraOfItem0();
    });
    // The element on screen belongs to item 1 now, whose state did not change.
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_ed4fb_test_4","item-key":0},{"position":1,"type":"__snapshot_ed4fb_test_4","item-key":1},{"position":2,"type":"__snapshot_ed4fb_test_4","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="1"
          >
            <view>
              <text>
                item 1
              </text>
              <wrapper>
                <text>
                  extra
                </text>
              </wrapper>
            </view>
          </list-item>
        </list>
      </page>
    `);

    // Item 0 comes back on screen: it renders from its updated state, and the
    // reused element still shows item 1.
    elementTree.enterListItemAtIndex(list, 0);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__snapshot_ed4fb_test_4","item-key":0},{"position":1,"type":"__snapshot_ed4fb_test_4","item-key":1},{"position":2,"type":"__snapshot_ed4fb_test_4","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="1"
          >
            <view>
              <text>
                item 1
              </text>
              <wrapper>
                <text>
                  extra
                </text>
              </wrapper>
            </view>
          </list-item>
          <list-item
            item-key="0"
          >
            <view>
              <text>
                item 0
              </text>
              <wrapper />
            </view>
          </list-item>
        </list>
      </page>
    `);
  });
});
