// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect } from 'vitest';

import { useState } from '@lynx-js/react';

import { render } from '..';
import { __pendingListUpdates } from '../../../runtime/lib/pendingListUpdates.js';

describe('list', () => {
  it('basic', async () => {
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    const Comp = () => {
      const [list, setList] = useState([0, 1, 2]);
      return (
        <list>
          {list.map((item) => (
            <list-item key={item} item-key={item}>
              <text>{item}</text>
            </list-item>
          ))}
        </list>
      );
    };

    const { container } = render(<Comp />);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__Card__:__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__Card__:__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        />
      </page>
    `);
    const list = container.firstChild;
    expect(list.props).toMatchInlineSnapshot(`undefined`);
    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "2": [
          {
            "insertAction": [],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "item-key": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
            ],
          },
        ],
      }
    `);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__Card__:__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__Card__:__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <text>
              0
            </text>
          </list-item>
        </list>
      </page>
    `);
    const uid1 = elementTree.enterListItemAtIndex(list, 1);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "2": [
          {
            "insertAction": [],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "item-key": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
              {
                "flush": false,
                "from": 1,
                "item-key": 1,
                "to": 1,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
            ],
          },
        ],
      }
    `);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__Card__:__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__Card__:__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <text>
              0
            </text>
          </list-item>
          <list-item
            item-key="1"
          >
            <text>
              1
            </text>
          </list-item>
        </list>
      </page>
    `);
    expect(uid0).toMatchInlineSnapshot(`2`);
    expect(uid1).toMatchInlineSnapshot(`5`);
    elementTree.leaveListItem(list, uid0);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "2": [
          {
            "insertAction": [],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "item-key": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
              {
                "flush": false,
                "from": 1,
                "item-key": 1,
                "to": 1,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
            ],
          },
        ],
      }
    `);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__Card__:__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__Card__:__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="0"
          >
            <text>
              0
            </text>
          </list-item>
          <list-item
            item-key="1"
          >
            <text>
              1
            </text>
          </list-item>
        </list>
      </page>
    `);
    const uid2 = elementTree.enterListItemAtIndex(list, 2);
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(
      `
      {
        "2": [
          {
            "insertAction": [],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "item-key": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
              {
                "flush": false,
                "from": 1,
                "item-key": 1,
                "to": 1,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
              {
                "flush": false,
                "from": 2,
                "item-key": 2,
                "to": 2,
                "type": "__Card__:__snapshot_a9e46_test_2",
              },
            ],
          },
        ],
      }
    `,
    );
    expect(container).toMatchInlineSnapshot(`
      <page>
        <list
          update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_2","item-key":0},{"position":1,"type":"__Card__:__snapshot_a9e46_test_2","item-key":1},{"position":2,"type":"__Card__:__snapshot_a9e46_test_2","item-key":2}],"removeAction":[],"updateAction":[]}]"
        >
          <list-item
            item-key="2"
          >
            <text>
              2
            </text>
          </list-item>
          <list-item
            item-key="1"
          >
            <text>
              1
            </text>
          </list-item>
        </list>
      </page>
    `);
    expect(uid2).toMatchInlineSnapshot(`2`);
    expect(uid0).toBe(uid2);
  });
  it('should reuse removed list item', async () => {
    let setListVal;
    let initListVal = Array(6).fill(0).map((v, i) => i);

    const A = () => {
      return <text>hello</text>;
    };
    const Comp = () => {
      const [listVal, _setListVal] = useState(initListVal);
      setListVal = _setListVal;
      const showMask = true;

      return (
        <view
          style={{
            width: '100vw',
            height: '100vh',
          }}
        >
          {
            <list
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              {listVal.map((v) => {
                return (
                  <list-item item-key={`${v}`} key={v} full-span>
                    <view>
                      {showMask
                        ? <text>{v}</text>
                        : null}
                      {showMask
                        ? <text>{v}</text>
                        : null}
                    </view>
                    {/* This will generate `__DynamicPartSlot` part for testing the hydration behavior of slot is as expected */}
                    <view>
                      <A />
                    </view>
                  </list-item>
                );
              })}
            </list>
          }
        </view>
      );
    };

    const { container } = render(<Comp />);
    expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          style="width:100vw;height:100vh"
        >
          <list
            style="width:100%;height:100%"
            update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"0","full-span":true},{"position":1,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"1","full-span":true},{"position":2,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"2","full-span":true},{"position":3,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"3","full-span":true},{"position":4,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"4","full-span":true},{"position":5,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]}]"
          />
        </view>
      </page>
    `);
    const list = container.firstChild.firstChild;

    const uid0 = elementTree.enterListItemAtIndex(list, 0);
    const uid1 = elementTree.enterListItemAtIndex(list, 1);
    const uid2 = elementTree.enterListItemAtIndex(list, 2);
    const uid3 = elementTree.enterListItemAtIndex(list, 3);

    const listItem3 = list.children[3];
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="3"
      >
        <view>
          <text>
            3
          </text>
          <text>
            3
          </text>
        </view>
        <view>
          <text>
            hello
          </text>
        </view>
      </list-item>
    `);

    elementTree.leaveListItem(list, uid0);
    const uid4 = elementTree.enterListItemAtIndex(list, 4);
    expect(uid4).toBe(uid0);

    elementTree.leaveListItem(list, uid1);
    const uid5 = elementTree.enterListItemAtIndex(list, 5);
    expect(uid5).toBe(uid1);

    // Remove the element 3
    act(() => {
      setListVal(initListVal.filter(x => x !== 3));
    });

    const __CreateElement = vi.spyOn(globalThis, '__CreateElement');
    const __SetAttribute = vi.spyOn(globalThis, '__SetAttribute');
    const __FlushElementTree = vi.spyOn(globalThis, '__FlushElementTree');

    // Remove action is generated
    expect(
      JSON.parse(list.getAttribute('update-list-info'))[1].removeAction,
    ).toMatchInlineSnapshot(`
      [
        3,
      ]
    `);
    // Reuse the element 3
    elementTree.leaveListItem(list, uid3);
    elementTree.enterListItemAtIndex(list, 1);

    expect(__CreateElement).toHaveBeenCalledTimes(0);
    expect(__SetAttribute).toHaveBeenCalledTimes(4);
    // The original FiberElement of element 3 is reused for
    // element 1 now
    expect(__SetAttribute.mock.calls[0][0]).toBe(listItem3);
    expect(__SetAttribute.mock.calls[0][0].$$uiSign).toBe(uid3);
    expect(listItem3).toMatchInlineSnapshot(`
      <list-item
        full-span="true"
        item-key="1"
      >
        <view>
          <text>
            1
          </text>
          <text>
            1
          </text>
        </view>
        <view>
          <text>
            hello
          </text>
        </view>
      </list-item>
    `);

    expect(__SetAttribute.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <view>
              <text>
                1
              </text>
              <text>
                1
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </list-item>,
          "item-key",
          "1",
        ],
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <view>
              <text>
                1
              </text>
              <text>
                1
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </list-item>,
          "full-span",
          true,
        ],
        [
          1,
          "text",
          1,
        ],
        [
          1,
          "text",
          1,
        ],
      ]
    `);
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
    expect(__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            full-span="true"
            item-key="1"
          >
            <view>
              <text>
                1
              </text>
              <text>
                1
              </text>
            </view>
            <view>
              <text>
                hello
              </text>
            </view>
          </list-item>,
          {
            "elementID": 36,
            "listID": 2,
            "operationID": undefined,
            "triggerLayout": true,
          },
        ],
      ]
    `);

    expect(list).toMatchInlineSnapshot(`
      <list
        style="width:100%;height:100%"
        update-list-info="[{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"0","full-span":true},{"position":1,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"1","full-span":true},{"position":2,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"2","full-span":true},{"position":3,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"3","full-span":true},{"position":4,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"4","full-span":true},{"position":5,"type":"__Card__:__snapshot_a9e46_test_6","item-key":"5","full-span":true}],"removeAction":[],"updateAction":[]},{"insertAction":[],"removeAction":[3],"updateAction":[]}]"
      >
        <list-item
          full-span="true"
          item-key="4"
        >
          <view>
            <text>
              4
            </text>
            <text>
              4
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </list-item>
        <list-item
          full-span="true"
          item-key="5"
        >
          <view>
            <text>
              5
            </text>
            <text>
              5
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </list-item>
        <list-item
          full-span="true"
          item-key="2"
        >
          <view>
            <text>
              2
            </text>
            <text>
              2
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </list-item>
        <list-item
          full-span="true"
          item-key="1"
        >
          <view>
            <text>
              1
            </text>
            <text>
              1
            </text>
          </view>
          <view>
            <text>
              hello
            </text>
          </view>
        </list-item>
      </list>
    `);
  });
});
