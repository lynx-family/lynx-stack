import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ReactLynx from '../../src/internal';
import { setupPage, SnapshotInstance, backgroundSnapshotInstanceManager } from '../../src/snapshot';
import { hydrate } from '../../src/hydrate';
import { BackgroundSnapshotInstance, hydrate as backgroundHydrate } from '../../src/backgroundSnapshot';
import { __pendingListUpdates } from '../../src/pendingListUpdates';
import { elementTree } from '../utils/nativeMethod';
import { prettyFormatSnapshotPatch } from '../../src/debug/formatPatch';
import { renderOpcodesInto } from '../../src/opcodes';
import renderToString from '../../src/renderToOpcodes';
import { jsx } from '../../lepus/jsx-runtime';
import { globalEnvManager } from '../utils/envManager';

const HOLE = null;

describe('legacy DynamicPartType should work', () => {
  it('DynamicPartType.Slot', () => {
    // Input:
    // <view>
    //   <text>Hello, ReactLynx, {hello1}</text>
    //   {hello2}
    // </view>
    const s0 = ReactLynx.createSnapshot(
      's0',
      function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText('Hello, ReactLynx, ');
        __AppendElement(el1, el2);
        const el3 = __CreateWrapperElement(pageId);
        __AppendElement(el1, el3);
        const el4 = __CreateWrapperElement(pageId);
        __AppendElement(el, el4);
        return [
          el,
          el1,
          el2,
          el3,
          el4,
        ];
      },
      null,
      [
        [
          ReactLynx.__DynamicPartSlot,
          3,
        ],
        [
          ReactLynx.__DynamicPartSlot,
          4,
        ],
      ],
      undefined,
      globDynamicComponentEntry,
      null,
    );

    const s1 = __SNAPSHOT__(<text>hello1</text>);
    const s2 = __SNAPSHOT__(<text>hello2</text>);

    const a = new SnapshotInstance(s0);
    a.ensureElements();
    const root = a.__element_root;

    const b1 = new SnapshotInstance('wrapper');
    const b2 = new SnapshotInstance(s1);
    b1.insertBefore(b2);

    const c1 = new SnapshotInstance('wrapper');
    const c2 = new SnapshotInstance(s2);
    c1.insertBefore(c2);

    a.insertBefore(b1);
    a.insertBefore(c1);

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="Hello, ReactLynx, "
          />
          <wrapper>
            <text>
              <raw-text
                text="hello1"
              />
            </text>
          </wrapper>
        </text>
        <wrapper>
          <text>
            <raw-text
              text="hello2"
            />
          </text>
        </wrapper>
      </view>
    `);

    const aa = new BackgroundSnapshotInstance(s0);
    {
      const s1 = __SNAPSHOT__(<text>hello3</text>);
      const s2 = __SNAPSHOT__(<text>hello4</text>);

      const b1 = new BackgroundSnapshotInstance('wrapper');
      const b2 = new BackgroundSnapshotInstance(s1);
      b1.insertBefore(b2);
      const c1 = new BackgroundSnapshotInstance('wrapper');
      const c2 = new BackgroundSnapshotInstance(s2);
      c1.insertBefore(c2);

      aa.insertBefore(b1);
      aa.insertBefore(c1);

      expect(prettyFormatSnapshotPatch(backgroundHydrate(JSON.parse(JSON.stringify(a)), aa))).toMatchInlineSnapshot(`
        [
          {
            "childId": -4,
            "op": "RemoveChild",
            "parentId": -3,
          },
          {
            "id": 3,
            "op": "CreateElement",
            "slotIndex": undefined,
            "type": "__Card__:__snapshot_a94a8_test_3",
          },
          {
            "beforeId": undefined,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": -3,
          },
          {
            "childId": -6,
            "op": "RemoveChild",
            "parentId": -5,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "slotIndex": undefined,
            "type": "__Card__:__snapshot_a94a8_test_4",
          },
          {
            "beforeId": undefined,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": -5,
          },
        ]
      `);
      backgroundSnapshotInstanceManager.values.forEach((v, k) => {
        expect(k).toEqual(v.__id);
      });
    }

    {
      const slotType = a.__snapshot_def.slot[0][0];
      // some supported slot type
      a.__snapshot_def.slot[0][0] = -1;
      expect(() => backgroundHydrate(JSON.parse(JSON.stringify(a)), aa)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Unexpected slot type: -1]`,
      );
      a.__snapshot_def.slot[0][0] = slotType;
    }

    {
      const slotType = aa.__snapshot_def.slot[0][0];
      // some supported slot type
      aa.__snapshot_def.slot[0][0] = -1;
      expect(() => backgroundHydrate(JSON.parse(JSON.stringify(a)), aa)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Unexpected slot type: -1]`,
      );
      aa.__snapshot_def.slot[0][0] = slotType;
    }
  });
  it('DynamicPartType.Slot with list-item hydrate', () => {
    const s0 = __SNAPSHOT__(<list>{HOLE}</list>);
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__element_root;

    // Input:
    // <list-item item-key={HOLE}>
    //     {HOLE}!{HOLE}
    // </list-item>
    const s1 = ReactLynx.createSnapshot(
      's1',
      function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateElement('list-item', pageId);
        const el1 = __CreateWrapperElement(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText('!');
        __AppendElement(el, el2);
        const el3 = __CreateWrapperElement(pageId);
        __AppendElement(el, el3);
        return [
          el,
          el1,
          el2,
          el3,
        ];
      },
      [
        (snapshot, index, oldValue) => ReactLynx.updateListItemPlatformInfo(snapshot, index, oldValue, 0),
      ],
      [
        [
          ReactLynx.__DynamicPartSlot,
          1,
        ],
        [
          ReactLynx.__DynamicPartSlot,
          3,
        ],
      ],
      void 0,
      globDynamicComponentEntry,
      null,
    );

    const slot = __SNAPSHOT__(<view id='!'>{HOLE}</view>);

    const c0 = new SnapshotInstance(s1);
    const c1 = new SnapshotInstance(s1);
    b.insertBefore(c0);
    b.insertBefore(c1);

    const c0_d0 = new SnapshotInstance(slot);
    const c0_d1 = new SnapshotInstance(slot);
    c0.insertBefore(c0_d0);
    c0.insertBefore(c0_d1);

    const c1_d0 = new SnapshotInstance(slot);
    const c1_d1 = new SnapshotInstance(slot);
    c1.insertBefore(c1_d0);
    c1.insertBefore(c1_d1);

    __pendingListUpdates.flush();

    const component = [];

    {
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      elementTree.triggerEnqueueComponent(listRef, component[0]);
      const slotType = c0.__snapshot_def.slot[0][0];
      // some supported slot type
      c0.__snapshot_def.slot[0][0] = -1;
      expect(() => elementTree.triggerComponentAtIndex(listRef, 1)).toThrowErrorMatchingInlineSnapshot(
        `[Error: Unexpected slot type: -1]`,
      );
      c0.__snapshot_def.slot[0][0] = slotType;
    }

    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
    expect(component[1]).toBe(component[0]);
    elementTree.triggerEnqueueComponent(listRef, component[1]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 0);
    expect(component[0]).toBe(component[1]);

    expect(listRef).toMatchInlineSnapshot(`
      <list
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "position": 0,
                  "type": "__Card__:s1",
                },
                {
                  "position": 1,
                  "type": "__Card__:s1",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      >
        <list-item>
          <view
            id="!"
          />
          <raw-text
            text="!"
          />
          <view
            id="!"
          />
        </list-item>
        <list-item>
          <view
            id="!"
          />
          <raw-text
            text="!"
          />
          <view
            id="!"
          />
        </list-item>
      </list>
    `);
  });
  it('DynamicPartType.Children with single text child', () => {
    globalEnvManager.switchToMainThread();
    setupPage(__CreatePage('0', 0));
    const scratch = document.createElement('root');
    scratch.ensureElements();

    // Input:
    // <view>
    // 	<text>{HOLE}</text>
    // </view>
    const s0 = ReactLynx.createSnapshot(
      's0',
      function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        return [
          el,
          el1,
        ];
      },
      null,
      [
        [
          ReactLynx.__DynamicPartChildren,
          1,
        ],
      ],
      undefined,
      globDynamicComponentEntry,
      null,
    );

    const opcodes = renderToString(
      jsx(s0, {
        children: 'hello',
      }),
    );

    expect(opcodes).toMatchInlineSnapshot(`
      [
        0,
        {
          "__slotIndex": undefined,
          "children": undefined,
          "extraProps": undefined,
          "id": -16,
          "type": "__Card__:s0",
          "values": undefined,
        },
        0,
        3,
        "hello",
        0,
        1,
      ]
    `);

    renderOpcodesInto(opcodes, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <view
        cssId="default-entry-from-native:0"
      >
        <text>
          <raw-text
            text="Hello, ReactLynx, "
          />
          <wrapper>
            <text>
              <raw-text
                text="hello1"
              />
            </text>
          </wrapper>
        </text>
        <wrapper>
          <text>
            <raw-text
              text="hello2"
            />
          </text>
        </wrapper>
        <view>
          <text>
            <raw-text
              text="hello"
            />
          </text>
        </view>
      </view>
    `);
  });
});
