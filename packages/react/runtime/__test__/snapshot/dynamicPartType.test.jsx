/** @jsxImportSource ../../lepus */

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
import { clearListGlobal, gRecycleMap, gSignMap } from '../../src/list';
import { jsx } from '../../lepus/jsx-runtime';
import { globalEnvManager } from '../utils/envManager';

const HOLE = null;

afterEach(() => {
  elementTree.clear();
  clearListGlobal();
});

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
            "childId": -11,
            "op": "RemoveChild",
            "parentId": -10,
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__snapshot_a94a8_test_3",
          },
          {
            "beforeId": undefined,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": -10,
            "slotIndex": undefined,
          },
          {
            "childId": -13,
            "op": "RemoveChild",
            "parentId": -12,
          },
          {
            "id": 5,
            "op": "CreateElement",
            "type": "__snapshot_a94a8_test_4",
          },
          {
            "beforeId": undefined,
            "childId": 5,
            "op": "InsertBefore",
            "parentId": -12,
            "slotIndex": undefined,
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
  describe('DynamicPartType.Children', () => {
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
    globalEnvManager.switchToMainThread();

    it('with single text child', () => {
      setupPage(__CreatePage('0', 0));
      const scratch = document.createElement('root');
      scratch.ensureElements();

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
            "id": -26,
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
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello, ReactLynx, "
              />
              <raw-text
                text="hello"
              />
            </text>
            <wrapper />
          </view>
        </page>
      `);
    });

    it('with single children', () => {
      setupPage(__CreatePage('0', 0));
      const scratch = document.createElement('root');
      scratch.ensureElements();

      const opcodes = renderToString(
        jsx(s0, {
          children: <text>children</text>,
        }),
      );

      expect(opcodes).toMatchInlineSnapshot(`
        [
          0,
          {
            "__slotIndex": undefined,
            "children": undefined,
            "extraProps": undefined,
            "id": -30,
            "type": "__Card__:s0",
            "values": undefined,
          },
          0,
          0,
          {
            "__slotIndex": undefined,
            "children": undefined,
            "extraProps": undefined,
            "id": -29,
            "type": "__snapshot_a94a8_test_7",
            "values": undefined,
          },
          0,
          1,
          1,
        ]
      `);

      renderOpcodesInto(opcodes, scratch);
      expect(scratch.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello, ReactLynx, "
              />
              <text>
                <raw-text
                  text="children"
                />
              </text>
            </text>
            <wrapper />
          </view>
        </page>
      `);
    });
  });
});

describe('DynamicPartType v2 should work', () => {
  const slotV2Host = ReactLynx.createSnapshot(
    'slot_v2_host',
    function() {
      const pageId = ReactLynx.__pageId;
      const el = __CreateView(pageId);
      return [el];
    },
    null,
    [
      [
        ReactLynx.__DynamicPartSlotV2,
        0,
      ],
    ],
    undefined,
    globDynamicComponentEntry,
    null,
  );

  const listSlotV2Host = ReactLynx.createSnapshot(
    'list_slot_v2_host',
    function() {
      const pageId = ReactLynx.__pageId;
      const el = __CreateElement('list', pageId);
      return [el];
    },
    null,
    [
      [
        ReactLynx.__DynamicPartListSlotV2,
        0,
      ],
    ],
    undefined,
    globDynamicComponentEntry,
    null,
  );

  const slotTextA = __SNAPSHOT__(<text>A</text>);
  const slotTextB = __SNAPSHOT__(<text>B</text>);
  const listItemA = __SNAPSHOT__(
    <list-item>
      <text>A</text>
    </list-item>,
  );
  const listItemB = __SNAPSHOT__(
    <list-item>
      <text>B</text>
    </list-item>,
  );

  it('renderToString should treat named children props as slot children', () => {
    const opcodes = renderToString(
      jsx(slotV2Host, {
        $0: <text>named child</text>,
      }),
    );

    expect(opcodes).toEqual([
      0,
      expect.objectContaining({
        type: '__Card__:slot_v2_host',
      }),
      0,
      0,
      expect.objectContaining({
        type: expect.stringMatching(/^__snapshot_/),
      }),
      0,
      1,
      1,
    ]);
  });

  it('hydrate should diff SlotV2 children by slot index', () => {
    setupPage(__CreatePage('0', 0));

    const before = new SnapshotInstance(slotV2Host);
    before.ensureElements();

    const beforeChild = new SnapshotInstance(slotTextA);
    beforeChild.__slotIndex = 0;
    before.insertBefore(beforeChild);

    expect(before.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="A"
          />
        </text>
      </view>
    `);

    const after = new SnapshotInstance(slotV2Host);
    const afterChild = new SnapshotInstance(slotTextB);
    afterChild.__slotIndex = 0;
    after.insertBefore(afterChild);

    hydrate(before, after);

    expect(before.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="B"
          />
        </text>
      </view>
    `);
  });

  it('background hydrate should diff SlotV2 children by slot index', () => {
    setupPage(__CreatePage('0', 0));

    const before = new SnapshotInstance(slotV2Host);
    const beforeChild = new SnapshotInstance(slotTextA);
    beforeChild.__slotIndex = 0;
    before.insertBefore(beforeChild);

    const after = new BackgroundSnapshotInstance(slotV2Host);
    const afterChild = new BackgroundSnapshotInstance(slotTextB);
    afterChild.__slotIndex = 0;
    after.insertBefore(afterChild);

    const patch = prettyFormatSnapshotPatch(
      backgroundHydrate(JSON.parse(JSON.stringify(before)), after),
    );

    expect(patch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'RemoveChild',
          parentId: before.__id,
          childId: before.childNodes[0].__id,
        }),
        expect.objectContaining({
          op: 'CreateElement',
          type: slotTextB,
        }),
        expect.objectContaining({
          op: 'InsertBefore',
          parentId: before.__id,
          beforeId: undefined,
          slotIndex: 0,
        }),
      ]),
    );
  });

  it('hydrate should diff ListSlotV2 children by slot index', () => {
    setupPage(__CreatePage('0', 0));

    const before = new SnapshotInstance(listSlotV2Host);
    before.ensureElements();

    const listID = __GetElementUniqueID(before.__element_root);
    gSignMap[listID] = new Map();
    gRecycleMap[listID] = new Map();

    const beforeChild = new SnapshotInstance(listItemA);
    beforeChild.__slotIndex = 0;
    beforeChild.__listItemPlatformInfo = { 'item-key': 0 };
    before.insertBefore(beforeChild);

    const after = new SnapshotInstance(listSlotV2Host);
    const afterChild = new SnapshotInstance(listItemB);
    afterChild.__slotIndex = 0;
    afterChild.__listItemPlatformInfo = { 'item-key': 0 };
    after.insertBefore(afterChild);

    hydrate(before, after);

    expect(__GetAttributeByName(before.__element_root, 'update-list-info')).toEqual([
      {
        insertAction: [
          {
            position: 0,
            type: listItemB,
            'item-key': 0,
          },
        ],
        removeAction: [0],
        updateAction: [],
      },
    ]);
  });
});
