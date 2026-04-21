import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementTree } from './utils/nativeMethod';
import {
  SnapshotInstance,
  snapshotInstanceManager,
  backgroundSnapshotInstanceManager,
  BackgroundSnapshotInstance,
  hydrate,
} from '../src/snapshot';
import { SnapshotOperationParams } from '../src/lifecycle/patch/snapshotPatch';
import { __pendingListUpdates } from '../src/list/pendingListUpdates';
import { getItemKeyOf } from '../src/renderToOpcodes/hydrate';

const HOLE = null;

export function formatSnapshotPatch(patch) {
  const out = [];
  for (let i = 0; i < patch.length;) {
    const op = patch[i];
    const meta = SnapshotOperationParams[op];
    if (!meta) {
      out.push(`UnknownOp(${String(op)})`);
      i += 1;
      continue;
    }
    const argc = meta.params.length;
    const args = patch.slice(i + 1, i + 1 + argc);
    out.push(`${meta.name}(${args.map(a => JSON.stringify(a)).join(', ')})`);
    i += 1 + argc;
  }
  return out;
}

beforeEach(() => {
  __pendingListUpdates.clearAttachedLists();
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
});

afterEach(() => {
  elementTree.clear();
});

describe('dual-runtime hydrate', () => {
  const s = __SNAPSHOT__(
    <view>
      <text>!!!</text>
      {HOLE}
    </view>,
  );

  const s1 = __SNAPSHOT__(
    <view>
      <text id={HOLE}>Hello</text>
      {HOLE}
    </view>,
  );

  const s2 = __SNAPSHOT__(
    <view>
      <text>World</text>
      {HOLE}
    </view>,
  );

  const s3 = __SNAPSHOT__(<image />);

  it('should works - insertBefore & setAttribute', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(s1);
    b1.__slotIndex = 0;
    const b2 = new SnapshotInstance(s1);
    b2.__slotIndex = 0;
    const b3 = new SnapshotInstance(s1);
    b3.__slotIndex = 0;
    b1.setAttribute(0, 'id~');
    a.insertBefore(b1);
    a.insertBefore(b2);
    a.insertBefore(b3);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <wrapper>
          <view>
            <text
              id="id~"
            >
              <raw-text
                text="Hello"
              />
            </text>
            <wrapper />
          </view>
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <wrapper />
          </view>
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
            <wrapper />
          </view>
        </wrapper>
      </view>
    `);

    {
      const aa = new BackgroundSnapshotInstance(s);

      const bb1 = new BackgroundSnapshotInstance(s1);
      bb1.__slotIndex = 0;
      const bb2 = new BackgroundSnapshotInstance(s2);
      bb2.__slotIndex = 0;
      const bb3 = new BackgroundSnapshotInstance(s1);
      bb3.__slotIndex = 0;
      const bb4 = new BackgroundSnapshotInstance(s1);
      bb4.__slotIndex = 0;
      const bb5 = new BackgroundSnapshotInstance(s1);
      bb5.__slotIndex = 0;
      bb1.setAttribute(0, '~id');
      bb5.setAttribute(0, '~id2');
      aa.insertBefore(bb1);
      aa.insertBefore(bb2);
      aa.insertBefore(bb3);
      aa.insertBefore(bb4);
      aa.insertBefore(bb5);

      const cc1 = new BackgroundSnapshotInstance(s3);
      cc1.__slotIndex = 0;
      const cc2 = new BackgroundSnapshotInstance(s3);
      cc2.__slotIndex = 0;
      const cc3 = new BackgroundSnapshotInstance(s1);
      cc3.__slotIndex = 0;
      cc3.setAttribute(0, '~id3');
      bb2.insertBefore(cc1);
      bb2.insertBefore(cc2);
      bb2.insertBefore(cc3);

      expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
        [
          3,
          -2,
          0,
          "~id",
          0,
          "__snapshot_a94a8_test_3",
          3,
          0,
          "__snapshot_a94a8_test_4",
          7,
          1,
          3,
          7,
          undefined,
          0,
          0,
          "__snapshot_a94a8_test_4",
          8,
          1,
          3,
          8,
          undefined,
          0,
          0,
          "__snapshot_a94a8_test_2",
          9,
          4,
          9,
          [
            "~id3",
          ],
          1,
          3,
          9,
          undefined,
          0,
          1,
          -1,
          3,
          -3,
          0,
          0,
          "__snapshot_a94a8_test_2",
          6,
          4,
          6,
          [
            "~id2",
          ],
          1,
          -1,
          6,
          undefined,
          0,
        ]
      `);
      backgroundSnapshotInstanceManager.values.forEach((v, k) => {
        expect(k).toEqual(v.__id);
      });
    }
  });

  it('should works - removeChild', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(s1);
    b1.__slotIndex = 0;
    const b2 = new SnapshotInstance(s1);
    b2.__slotIndex = 0;
    const b3 = new SnapshotInstance(s1);
    b3.__slotIndex = 0;
    const b4 = new SnapshotInstance(s1);
    b4.__slotIndex = 0;
    a.insertBefore(b1);
    a.insertBefore(b2);
    a.insertBefore(b3);
    a.insertBefore(b4);

    const aa = new BackgroundSnapshotInstance(s);

    const bb1 = new BackgroundSnapshotInstance(s1);
    bb1.__slotIndex = 0;
    const bb2 = new BackgroundSnapshotInstance(s1);
    bb2.__slotIndex = 0;
    const bb3 = new BackgroundSnapshotInstance(s1);
    bb3.__slotIndex = 0;
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    aa.insertBefore(bb3);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
      [
        2,
        -1,
        -5,
      ]
    `);
  });

  it('should works - move', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(s1);
    b1.__slotIndex = 0;
    const b2 = new SnapshotInstance(s1);
    b2.__slotIndex = 0;
    const b3 = new SnapshotInstance(s2);
    b3.__slotIndex = 0;
    const b4 = new SnapshotInstance(s1);
    b4.__slotIndex = 0;
    a.insertBefore(b1);
    a.insertBefore(b2);
    a.insertBefore(b3);
    a.insertBefore(b4);

    const aa = new BackgroundSnapshotInstance(s);

    const bb1 = new BackgroundSnapshotInstance(s1);
    bb1.__slotIndex = 0;
    const bb2 = new BackgroundSnapshotInstance(s2);
    bb2.__slotIndex = 0;
    const bb3 = new BackgroundSnapshotInstance(s1);
    bb3.__slotIndex = 0;
    const bb4 = new BackgroundSnapshotInstance(s1);
    bb4.__slotIndex = 0;
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    aa.insertBefore(bb3);
    aa.insertBefore(bb4);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
      [
        1,
        -1,
        -3,
        -5,
        0,
      ]
    `);
  });

  it('should works - upon empty render', async function() {
    const aa = new BackgroundSnapshotInstance('root');

    const bb1 = new BackgroundSnapshotInstance(s1);
    const bb2 = new BackgroundSnapshotInstance(s2);
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);

    // happens when first-screen render is failed
    expect(hydrate({ id: -1, type: 'root' }, aa)).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_2",
        2,
        1,
        -1,
        2,
        undefined,
        undefined,
        0,
        "__snapshot_a94a8_test_3",
        3,
        1,
        -1,
        3,
        undefined,
        undefined,
      ]
    `);
  });
});

describe('dual-runtime hydrate - with slot (multi-children)', () => {
  const s = __SNAPSHOT__(
    <view>
      <text>!!!</text>
      {HOLE}!{HOLE}
    </view>,
  );

  const slot1 = __SNAPSHOT__(<view>{HOLE}</view>);
  const slot2 = __SNAPSHOT__(<view>{HOLE}</view>);

  const s1 = __SNAPSHOT__(<text>Hello World</text>);

  it('should works - slot', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(slot1);
    b1.__slotIndex = 0;
    const b2 = new SnapshotInstance(slot2);
    b2.__slotIndex = 1;
    a.insertBefore(b1);
    a.insertBefore(b2);
    const c1 = new SnapshotInstance(s1);
    c1.__slotIndex = 0;
    const c2 = new SnapshotInstance(s1);
    c2.__slotIndex = 0;
    const c3 = new SnapshotInstance(s1);
    c3.__slotIndex = 0;
    b1.insertBefore(c1);
    b1.insertBefore(c2);
    b2.insertBefore(c3);

    const aa = new BackgroundSnapshotInstance(s);
    const bb1 = new BackgroundSnapshotInstance(slot1);
    bb1.__slotIndex = 0;
    const bb2 = new BackgroundSnapshotInstance(slot2);
    bb2.__slotIndex = 1;
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    const cc1 = new BackgroundSnapshotInstance(s1);
    cc1.__slotIndex = 0;
    const cc2 = new BackgroundSnapshotInstance(s1);
    cc2.__slotIndex = 0;
    const cc3 = new BackgroundSnapshotInstance(s1);
    cc3.__slotIndex = 0;
    bb1.insertBefore(cc1);
    bb2.insertBefore(cc2);
    bb2.insertBefore(cc3);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
      [
        2,
        -2,
        -5,
        0,
        "__snapshot_a94a8_test_8",
        6,
        1,
        -3,
        6,
        undefined,
        0,
      ]
    `);
  });
});

describe('dual-runtime hydrate - with list', () => {
  const listHolder = __SNAPSHOT__(
    <list id='list'>
      {HOLE}
    </list>,
  );
  const listItem = __SNAPSHOT__(
    <list-item item-key={HOLE}>
      <text>Item</text>
    </list-item>,
  );

  it('should works - list', () => {
    const mtsList = new SnapshotInstance(listHolder);
    mtsList.ensureElements();
    const listRef = mtsList.__elements[0];

    const mtsListItem0 = new SnapshotInstance(listItem);
    mtsListItem0.setAttribute(0, { 'item-key': 'mts-list-item-0' });
    const mtsListItem1 = new SnapshotInstance(listItem);
    mtsListItem1.setAttribute(0, { 'item-key': 'mts-list-item-1' });
    const mtsListItem2 = new SnapshotInstance(listItem);
    mtsListItem2.setAttribute(0, { 'item-key': 'mts-list-item-2' });
    mtsList.insertBefore(mtsListItem0);
    mtsList.insertBefore(mtsListItem1);
    mtsList.insertBefore(mtsListItem2);
    __pendingListUpdates.flush();
    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "item-key": "mts-list-item-0",
                  "position": 0,
                  "type": "__snapshot_a94a8_test_10",
                },
                {
                  "item-key": "mts-list-item-1",
                  "position": 1,
                  "type": "__snapshot_a94a8_test_10",
                },
                {
                  "item-key": "mts-list-item-2",
                  "position": 2,
                  "type": "__snapshot_a94a8_test_10",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      />
    `);
    const getItemKeyFromValues = (values) => {
      for (let index = 0; index < values?.length; index++) {
        const value = values[index];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if ('item-key' in value) {
            return value['item-key'] ?? undefined;
          }
        }
      }
      return undefined;
    };
    mtsList.childNodes.forEach((node, index) => {
      const itemKey = getItemKeyFromValues(node.__values);
      expect(itemKey).toBeTypeOf('string');
      expect(itemKey).toBe(`mts-list-item-${index}`);
    });

    const btsList = new BackgroundSnapshotInstance(listHolder);
    const btsListItem0 = new BackgroundSnapshotInstance(listItem);
    btsListItem0.setAttribute(0, { 'item-key': 'bts-list-item-0' });
    const btsListItem1 = new BackgroundSnapshotInstance(listItem);
    btsListItem1.setAttribute(0, { 'item-key': 'bts-list-item-1' });
    const btsListItem2 = new BackgroundSnapshotInstance(listItem);
    btsListItem2.setAttribute(0, { 'item-key': 'bts-list-item-2' });
    btsList.insertBefore(btsListItem0);
    btsList.insertBefore(btsListItem1);
    btsList.insertBefore(btsListItem2);

    btsList.childNodes.forEach((node, index) => {
      const itemKey = getItemKeyFromValues(node.__values);
      expect(itemKey).toBeTypeOf('string');
      expect(itemKey).toBe(`bts-list-item-${index}`);
    });
    const patches = hydrate(JSON.parse(JSON.stringify(mtsList)), btsList);
    expect(patches).toMatchInlineSnapshot(`
      [
        2,
        -1,
        -2,
        2,
        -1,
        -3,
        2,
        -1,
        -4,
        0,
        "__snapshot_a94a8_test_10",
        2,
        4,
        2,
        [
          {
            "item-key": "bts-list-item-0",
          },
        ],
        1,
        -1,
        2,
        undefined,
        0,
        "__snapshot_a94a8_test_10",
        3,
        4,
        3,
        [
          {
            "item-key": "bts-list-item-1",
          },
        ],
        1,
        -1,
        3,
        undefined,
        0,
        "__snapshot_a94a8_test_10",
        4,
        4,
        4,
        [
          {
            "item-key": "bts-list-item-2",
          },
        ],
        1,
        -1,
        4,
        undefined,
      ]
    `);
    expect(formatSnapshotPatch(patches)).toMatchInlineSnapshot(`
      [
        "RemoveChild(-1, -2)",
        "RemoveChild(-1, -3)",
        "RemoveChild(-1, -4)",
        "CreateElement("__snapshot_a94a8_test_10", 2)",
        "SetAttributes(2, [{"item-key":"bts-list-item-0"}])",
        "InsertBefore(-1, 2, )",
        "CreateElement("__snapshot_a94a8_test_10", 3)",
        "SetAttributes(3, [{"item-key":"bts-list-item-1"}])",
        "InsertBefore(-1, 3, )",
        "CreateElement("__snapshot_a94a8_test_10", 4)",
        "SetAttributes(4, [{"item-key":"bts-list-item-2"}])",
        "InsertBefore(-1, 4, )",
      ]
    `);
  });
});

describe('renderToOpcodes hydrate - getItemKeyOf', () => {
  it('should get item-key from __listItemPlatformInfo', () => {
    expect(getItemKeyOf({ __listItemPlatformInfo: { 'item-key': 'k' } }, true)).toBe('k');
  });

  it('should return undefined when __listItemPlatformInfo has no item-key', () => {
    expect(getItemKeyOf({ __listItemPlatformInfo: {} }, true)).toBe(undefined);
  });

  it('should get item-key from values when before node', () => {
    expect(getItemKeyOf({ values: [null, 1, { 'item-key': 'k2' }] }, true)).toBe('k2');
  });

  it('should return undefined when values includes item-key undefined', () => {
    expect(getItemKeyOf({ values: [{ 'item-key': undefined }] }, true)).toBe(undefined);
  });

  it('should get item-key from __values when after node', () => {
    expect(getItemKeyOf({ __values: [{ 'item-key': 'k3' }] }, false)).toBe('k3');
  });
});
