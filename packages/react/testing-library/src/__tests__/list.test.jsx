import { describe, expect } from 'vitest';
import { render } from '..';
import { useState } from '@lynx-js/react';
import { __pendingListUpdates } from '../../../runtime/lib/list.js';

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
});
