import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementTree } from './utils/nativeMethod';
import { BackgroundSnapshotInstance, hydrate } from '../src/backgroundSnapshot';
import { backgroundSnapshotInstanceManager, SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';

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

      expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
        [
          3,
          -2,
          0,
          "~id",
          0,
          "__Card__:__snapshot_a94a8_test_3",
          3,
          undefined,
          0,
          "__Card__:__snapshot_a94a8_test_4",
          7,
          undefined,
          1,
          3,
          7,
          undefined,
          0,
          "__Card__:__snapshot_a94a8_test_4",
          8,
          undefined,
          1,
          3,
          8,
          undefined,
          0,
          "__Card__:__snapshot_a94a8_test_2",
          9,
          undefined,
          4,
          9,
          [
            "~id3",
          ],
          1,
          3,
          9,
          undefined,
          1,
          -1,
          3,
          -3,
          0,
          "__Card__:__snapshot_a94a8_test_2",
          6,
          undefined,
          4,
          6,
          [
            "~id2",
          ],
          1,
          -1,
          6,
          undefined,
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

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
      [
        1,
        -1,
        -3,
        -5,
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
    const b2 = new SnapshotInstance(slot2);
    a.insertBefore(b1);
    a.insertBefore(b2);
    const c1 = new SnapshotInstance(s1);
    const c2 = new SnapshotInstance(s1);
    const c3 = new SnapshotInstance(s1);
    b1.insertBefore(c1);
    b1.insertBefore(c2);
    b2.insertBefore(c3);

    const aa = new BackgroundSnapshotInstance(s);
    const bb1 = new BackgroundSnapshotInstance(slot1);
    const bb2 = new BackgroundSnapshotInstance(slot2);
    aa.insertBefore(bb1);
    aa.insertBefore(bb2);
    const cc1 = new BackgroundSnapshotInstance(s1);
    const cc2 = new BackgroundSnapshotInstance(s1);
    const cc3 = new BackgroundSnapshotInstance(s1);
    bb1.insertBefore(cc1);
    bb2.insertBefore(cc2);
    bb2.insertBefore(cc3);

    expect(hydrate(JSON.parse(JSON.stringify(a)), aa)).toMatchInlineSnapshot(`
      [
        2,
        -2,
        -5,
        0,
        "__Card__:__snapshot_a94a8_test_8",
        6,
        undefined,
        1,
        -3,
        6,
        undefined,
        2,
        -2,
        -5,
        0,
        "__Card__:__snapshot_a94a8_test_8",
        6,
        undefined,
        1,
        -3,
        6,
        undefined,
      ]
    `);
  });
});
