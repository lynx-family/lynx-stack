import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementTree } from './utils/nativeMethod';
import { BackgroundSnapshotInstance, hydrate } from '../src/backgroundSnapshot';
import { backgroundSnapshotInstanceManager, SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';
import { prettyFormatSnapshotPatch } from '../src/debug/formatPatch';
import { backgroundSnapshotInstanceToJSON } from './utils/debug';

const HOLE = null;

beforeEach(() => {
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
    const b2 = new SnapshotInstance(s1);
    const b3 = new SnapshotInstance(s1);
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
      const bb2 = new BackgroundSnapshotInstance(s2);
      const bb3 = new BackgroundSnapshotInstance(s1);
      const bb4 = new BackgroundSnapshotInstance(s1);
      const bb5 = new BackgroundSnapshotInstance(s1);
      bb1.setAttribute(0, '~id');
      bb5.setAttribute(0, '~id2');
      aa.insertBefore(bb1);
      aa.insertBefore(bb2);
      aa.insertBefore(bb3);
      aa.insertBefore(bb4);
      aa.insertBefore(bb5);

      const cc1 = new BackgroundSnapshotInstance(s3);
      const cc2 = new BackgroundSnapshotInstance(s3);
      const cc3 = new BackgroundSnapshotInstance(s1);
      cc3.setAttribute(0, '~id3');
      bb2.insertBefore(cc1);
      bb2.insertBefore(cc2);
      bb2.insertBefore(cc3);

      expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`[]`);
      backgroundSnapshotInstanceManager.values.forEach((v, k) => {
        expect(k).toEqual(v.__id);
      });
    }
  });

  it('should works - removeChild', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(s1);
    const b2 = new SnapshotInstance(s1);
    const b3 = new SnapshotInstance(s1);
    const b4 = new SnapshotInstance(s1);
    a.insertBefore(b1);
    a.insertBefore(b2);
    a.insertBefore(b3);
    a.insertBefore(b4);

    const aa = new BackgroundSnapshotInstance(s);

    const bb1 = new BackgroundSnapshotInstance(s1);
    const bb2 = new BackgroundSnapshotInstance(s1);
    const bb3 = new BackgroundSnapshotInstance(s1);
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    aa.insertBefore(bb3);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`[]`);
  });

  it('should works - move', async function() {
    const a = new SnapshotInstance(s);
    a.ensureElements();
    const b1 = new SnapshotInstance(s1);
    const b2 = new SnapshotInstance(s1);
    const b3 = new SnapshotInstance(s2);
    const b4 = new SnapshotInstance(s1);
    a.insertBefore(b1);
    a.insertBefore(b2);
    a.insertBefore(b3);
    a.insertBefore(b4);

    const aa = new BackgroundSnapshotInstance(s);

    const bb1 = new BackgroundSnapshotInstance(s1);
    const bb2 = new BackgroundSnapshotInstance(s2);
    const bb3 = new BackgroundSnapshotInstance(s1);
    const bb4 = new BackgroundSnapshotInstance(s1);
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    aa.insertBefore(bb3);
    aa.insertBefore(bb4);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`[]`);
  });

  it('should works - upon empty render', async function() {
    const aa = new BackgroundSnapshotInstance('root');

    const bb1 = new BackgroundSnapshotInstance(s1);
    const bb2 = new BackgroundSnapshotInstance(s2);
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);

    // happens when first-screen render is failed
    expect(hydrate({ 'id': -1, 'type': 'root' }, aa)).toMatchInlineSnapshot(`
      [
        0,
        "__Card__:__snapshot_a94a8_test_2",
        2,
        undefined,
        1,
        -1,
        2,
        undefined,
        0,
        "__Card__:__snapshot_a94a8_test_3",
        3,
        undefined,
        1,
        -1,
        3,
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

    expect(JSON.stringify(a, null, 2)).toMatchInlineSnapshot(`
      "{
        "id": -1,
        "type": "__Card__:__snapshot_a94a8_test_5",
        "children": [
          {
            "id": -2,
            "type": "__Card__:__snapshot_a94a8_test_6",
            "children": [
              {
                "id": -4,
                "type": "__Card__:__snapshot_a94a8_test_8",
                "__slotIndex": 0
              },
              {
                "id": -5,
                "type": "__Card__:__snapshot_a94a8_test_8",
                "__slotIndex": 0
              }
            ],
            "__slotIndex": 0
          },
          {
            "id": -3,
            "type": "__Card__:__snapshot_a94a8_test_7",
            "children": [
              {
                "id": -6,
                "type": "__Card__:__snapshot_a94a8_test_8",
                "__slotIndex": 0
              }
            ],
            "__slotIndex": 1
          }
        ]
      }"
    `);
    BackgroundSnapshotInstance.prototype.toJSON = backgroundSnapshotInstanceToJSON;
    expect(JSON.stringify(aa, null, 2)).toMatchInlineSnapshot(`
      "{
        "type": "__Card__:__snapshot_a94a8_test_5",
        "children": [
          {
            "type": "__Card__:__snapshot_a94a8_test_6",
            "children": [
              {
                "type": "__Card__:__snapshot_a94a8_test_8",
                "children": [],
                "props": {},
                "__slotIndex": 0
              }
            ],
            "props": {},
            "__slotIndex": 0
          },
          {
            "type": "__Card__:__snapshot_a94a8_test_7",
            "children": [
              {
                "type": "__Card__:__snapshot_a94a8_test_8",
                "children": [],
                "props": {},
                "__slotIndex": 0
              },
              {
                "type": "__Card__:__snapshot_a94a8_test_8",
                "children": [],
                "props": {},
                "__slotIndex": 0
              }
            ],
            "props": {},
            "__slotIndex": 1
          }
        ],
        "props": {}
      }"
    `);

    const snapshotPatch = hydrate(JSON.parse(JSON.stringify(a)), aa);
    expect(snapshotPatch).toMatchInlineSnapshot(`
      [
        2,
        -2,
        -5,
        0,
        "__Card__:__snapshot_a94a8_test_8",
        6,
        0,
        1,
        -3,
        6,
        undefined,
      ]
    `);
    expect(prettyFormatSnapshotPatch(snapshotPatch)).toMatchInlineSnapshot(`
      [
        {
          "childId": -5,
          "op": "RemoveChild",
          "parentId": -2,
        },
        {
          "id": 6,
          "op": "CreateElement",
          "slotIndex": 0,
          "type": "__Card__:__snapshot_a94a8_test_8",
        },
        {
          "beforeId": undefined,
          "childId": 6,
          "op": "InsertBefore",
          "parentId": -3,
        },
      ]
    `);
  });
});
