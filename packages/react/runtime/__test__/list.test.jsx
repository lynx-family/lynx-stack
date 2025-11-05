/** @jsxImportSource ../lepus */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree, nativeMethodQueue } from './utils/nativeMethod';
import { hydrate } from '../src/hydrate';
import { __pendingListUpdates } from '../src/pendingListUpdates';
import { SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';
import { __root } from '../src/root';
import { globalEnvManager } from './utils/envManager';
import { gRecycleMap, gSignMap } from '../src/list';

const HOLE = null;

beforeEach(() => {
  // snapshotManager.values.clear();
  __pendingListUpdates.clearAttachedLists();
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
});

afterEach(() => {
  elementTree.clear();
});

describe('list', () => {
  const s = __SNAPSHOT__(
    <view>
      <text>Hello</text>
      {HOLE}
    </view>,
  );

  it('list top-level', async function() {
    const s1 = __SNAPSHOT__(<list>{HOLE}</list>);
    const s2 = __SNAPSHOT__(<text>World</text>);

    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    const c = new SnapshotInstance(s2);

    a.insertBefore(b);
    a.insertBefore(c);

    const d1 = new SnapshotInstance(s2);
    const d2 = new SnapshotInstance(s2);
    const d3 = new SnapshotInstance(s2);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <wrapper>
          <list />
          <text>
            <raw-text
              text="World"
            />
          </text>
        </wrapper>
      </view>
    `);

    expect(b.childNodes.length).toMatchInlineSnapshot(`3`);

    b.insertBefore(d3); // take no effects
    b.removeChild(d3);
    expect(b.childNodes.length).toMatchInlineSnapshot(`2`);
  });

  it('should be able to insertBefore into list snapshot instance', async function() {
    const s1 = __SNAPSHOT__(
      <view>
        <text>111</text>
        <list>{HOLE}</list>
      </view>,
    );
    const s2 = __SNAPSHOT__(<text>World</text>);
    const s3 = __SNAPSHOT__(
      <list-item item-key={1}>
        <text>World</text>
      </list-item>,
    );

    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    const c = new SnapshotInstance(s2);

    a.insertBefore(b);
    a.insertBefore(c);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <wrapper>
          <view>
            <text>
              <raw-text
                text="111"
              />
            </text>
            <list />
          </view>
          <text>
            <raw-text
              text="World"
            />
          </text>
        </wrapper>
      </view>
    `);

    expect(b.childNodes.length).toMatchInlineSnapshot(`3`);

    b.insertBefore(d2);
    b.removeChild(d2);
    expect(b.childNodes.length).toMatchInlineSnapshot(`2`);
  });

  it('list slot count > 1 (the wrapper should be generated)', async function() {
    const s1 = __SNAPSHOT__(
      <view>
        <text>111</text>
        <list>
          {HOLE}
          <list-item></list-item>
        </list>
        {HOLE}
      </view>,
    );
    const s2 = __SNAPSHOT__(<text>World</text>);

    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    const c = new SnapshotInstance(s2);

    a.insertBefore(b);
    a.insertBefore(c);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <wrapper>
          <view>
            <text>
              <raw-text
                text="111"
              />
            </text>
            <wrapper />
            <wrapper />
          </view>
          <text>
            <raw-text
              text="World"
            />
          </text>
        </wrapper>
      </view>
    `);
  });
});

describe(`list "update-list-info"`, () => {
  const s = __SNAPSHOT__(
    <view>
      <text>Hello</text>
      {HOLE}
    </view>,
  );
  it(`"update-list-info" should work when insertBefore and removeChild`, async function() {
    const s1 = __SNAPSHOT__(
      <view>
        <text>111</text>
        <list>{HOLE}</list>
      </view>,
    );
    const s2 = __SNAPSHOT__(<text>World</text>);
    const s3 = __SNAPSHOT__(
      <list-item item-key={1}>
        <text>World</text>
      </list-item>,
    );
    const s4 = __SNAPSHOT__(
      <list-item item-key={4}>
        <text>Lynx</text>
      </list-item>,
    );

    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    const c = new SnapshotInstance(s2);

    a.insertBefore(b);
    a.insertBefore(c);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    expect(b.childNodes.length).toMatchInlineSnapshot(`3`);

    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-6": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_14",
              },
              {
                "position": 1,
                "type": "__Card__:__snapshot_a94a8_test_14",
              },
              {
                "position": 2,
                "type": "__Card__:__snapshot_a94a8_test_14",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
      }
    `);

    {
      __pendingListUpdates.clearAttachedLists();
      const d4 = new SnapshotInstance(s3);
      const d5 = new SnapshotInstance(s3);
      const d6 = new SnapshotInstance(s4);
      const d7 = new SnapshotInstance(s4);
      b.insertBefore(d4);
      b.insertBefore(d5, d2);
      b.insertBefore(d6, d2);
      b.insertBefore(d7, d2);
      b.removeChild(d2);
      expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
        {
          "-6": [
            {
              "insertAction": [
                {
                  "position": 1,
                  "type": "__Card__:__snapshot_a94a8_test_14",
                },
                {
                  "position": 2,
                  "type": "__Card__:__snapshot_a94a8_test_15",
                },
                {
                  "position": 3,
                  "type": "__Card__:__snapshot_a94a8_test_15",
                },
                {
                  "position": 5,
                  "type": "__Card__:__snapshot_a94a8_test_14",
                },
              ],
              "removeAction": [
                1,
              ],
              "updateAction": [],
            },
          ],
        }
      `);
    }

    {
      __pendingListUpdates.clearAttachedLists();
      b.insertBefore(d3); // move
      expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
        {
          "-6": [
            {
              "insertAction": [
                {
                  "position": 5,
                  "type": "__Card__:__snapshot_a94a8_test_14",
                },
              ],
              "removeAction": [
                4,
              ],
              "updateAction": [],
            },
          ],
        }
      `);
    }
  });

  it(`"update-list-info" should work when setAttribute`, () => {
    const s1 = __SNAPSHOT__(
      <view>
        <text>111</text>
        <list>{HOLE}</list>
      </view>,
    );

    const b = new SnapshotInstance(s1);
    b.ensureElements();

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    __pendingListUpdates.clearAttachedLists();

    d1.setAttribute(0, { 'item-key': 1 });
    d3.setAttribute(0, { 'item-key': 3 });
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-2": [
          {
            "insertAction": [],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "item-key": 1,
                "to": 0,
                "type": "__Card__:__snapshot_a94a8_test_17",
              },
              {
                "flush": false,
                "from": 2,
                "item-key": 3,
                "to": 2,
                "type": "__Card__:__snapshot_a94a8_test_17",
              },
            ],
          },
        ],
      }
    `);
  });
});

describe(`list componentAtIndex`, () => {
  const s = __SNAPSHOT__(
    <view>
      <text>Hello</text>
      {HOLE}
    </view>,
  );
  const s1 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  const s3 = __SNAPSHOT__(
    <list-item item-key={HOLE}>
      <text>World</text>
    </list-item>,
  );

  it('basic componentAtIndex after insert', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    // initial there is no child, because "update-list-info" is not flush
    expect(() => {
      elementTree.triggerComponentAtIndex(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: childCtx not found]`);

    // only call componentAtIndex after flush
    __pendingListUpdates.flush();
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`4`);
    expect(elementTree.triggerComponentAtIndex(listRef, 1)).toMatchInlineSnapshot(`7`);
    expect(elementTree.triggerComponentAtIndex(listRef, 2)).toMatchInlineSnapshot(`10`);
  });

  it('remove list si', () => {
    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    a.insertBefore(b);
    const listRef = b.__elements[3];
    expect(() => {
      elementTree.triggerComponentAtIndex(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: childCtx not found]`);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    __pendingListUpdates.flush();

    a.removeChild(b);
    expect(() => {
      elementTree.triggerComponentAtIndex(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: componentAtIndex called on removed list]`);
    expect(() => {
      elementTree.triggerEnqueueComponent(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: enqueueComponent called on removed list]`);
  });

  it('should reuse and hydrate', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text bindtap={HOLE}>
          <raw-text text={HOLE} />
        </text>
      </list-item>,
    );

    const c0 = new SnapshotInstance(s3);
    const c1 = new SnapshotInstance(s3);
    const c2 = new SnapshotInstance(s3);
    const c3 = new SnapshotInstance(s3);
    const c4 = new SnapshotInstance(s3);
    const c5 = new SnapshotInstance(s3);
    b.insertBefore(c0);
    b.insertBefore(c1);
    b.insertBefore(c2);
    b.insertBefore(c3);
    b.insertBefore(c4);
    b.insertBefore(c5);

    // item-key
    c0.setAttribute(0, { 'item-key': 'key-0' });
    c1.setAttribute(0, { 'item-key': 'key-1' });
    c2.setAttribute(0, { 'item-key': 'key-2' });
    c3.setAttribute(0, { 'item-key': 'key-3' });
    c4.setAttribute(0, { 'item-key': 'key-4' });
    c5.setAttribute(0, { 'item-key': 'key-5' });

    // event
    c0.setAttribute(1, 1);
    c1.setAttribute(1, 1);
    c2.setAttribute(1, 1);
    c3.setAttribute(1, 1);
    c4.setAttribute(1, 1);
    c5.setAttribute(1, 1);

    // text
    c0.setAttribute(2, '0');
    c1.setAttribute(2, '1');
    c2.setAttribute(2, '2');
    c3.setAttribute(2, '3');
    c4.setAttribute(2, '4');
    c5.setAttribute(2, '5');

    __pendingListUpdates.flush();

    {
      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2);
      component[3] = elementTree.triggerComponentAtIndex(listRef, 3);

      elementTree.triggerEnqueueComponent(listRef, component[0]);
      component[4] = elementTree.triggerComponentAtIndex(listRef, 4);
      expect(component[4]).toBe(component[0]);

      elementTree.triggerEnqueueComponent(listRef, component[1]);
      component[5] = elementTree.triggerComponentAtIndex(listRef, 5);
      expect(component[5]).toBe(component[1]);

      // should ignore
      elementTree.triggerEnqueueComponent(listRef, 99999);
    }

    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "item-key": "key-0",
                  "position": 0,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
                {
                  "item-key": "key-1",
                  "position": 1,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
                {
                  "item-key": "key-2",
                  "position": 2,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
                {
                  "item-key": "key-3",
                  "position": 3,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
                {
                  "item-key": "key-4",
                  "position": 4,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
                {
                  "item-key": "key-5",
                  "position": 5,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      >
        <list-item
          item-key="key-4"
        >
          <text
            event={
              {
                "bindEvent:tap": "-7:1:",
              }
            }
          >
            <raw-text
              text="4"
            />
          </text>
        </list-item>
        <list-item
          item-key="key-5"
        >
          <text
            event={
              {
                "bindEvent:tap": "-8:1:",
              }
            }
          >
            <raw-text
              text="5"
            />
          </text>
        </list-item>
        <list-item
          item-key="key-2"
        >
          <text
            event={
              {
                "bindEvent:tap": "-5:1:",
              }
            }
          >
            <raw-text
              text="2"
            />
          </text>
        </list-item>
        <list-item
          item-key="key-3"
        >
          <text
            event={
              {
                "bindEvent:tap": "-6:1:",
              }
            }
          >
            <raw-text
              text="3"
            />
          </text>
        </list-item>
      </list>
    `);
  });

  const _s3 = __SNAPSHOT__(<list-item item-key={HOLE}>{HOLE}</list-item>);
  const _s4 = __SNAPSHOT__(<text>Hello</text>);
  const _s5 = __SNAPSHOT__(<text>World</text>);
  it('should reuse and hydrate - with childNodes', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const c0 = new SnapshotInstance(_s3);
    const c1 = new SnapshotInstance(_s3);
    const c2 = new SnapshotInstance(_s3);
    b.insertBefore(c0);
    b.insertBefore(c1);
    b.insertBefore(c2);

    const c0_d0 = new SnapshotInstance(_s4);
    const c0_d1 = new SnapshotInstance(_s5);
    c0.insertBefore(c0_d0);
    c0.insertBefore(c0_d1);

    const c1_d0 = new SnapshotInstance(_s4);
    c1.insertBefore(c1_d0);

    const c2_d0 = new SnapshotInstance(_s5);
    c2.insertBefore(c2_d0);

    __pendingListUpdates.flush();

    const component = [];
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);

    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <text>
          <raw-text
            text="World"
          />
        </text>
      </list-item>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
    expect(component[1]).toBe(component[0]);

    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
      </list-item>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[1]);
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
    expect(component[0]).toBe(component[1]);

    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <text>
          <raw-text
            text="World"
          />
        </text>
      </list-item>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[2] = elementTree.triggerComponentAtIndex(listRef, 2);

    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item>
        <text>
          <raw-text
            text="World"
          />
        </text>
      </list-item>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[2]);
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);

    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item>
        <text>
          <raw-text
            text="Hello"
          />
        </text>
        <text>
          <raw-text
            text="World"
          />
        </text>
      </list-item>
    `);
  });

  it('should reuse and hydrate - with childNodes - move', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(<list-item item-key={HOLE}>{HOLE}</list-item>);
    const s4 = __SNAPSHOT__(<text>Hello</text>);
    const s5 = __SNAPSHOT__(<text>World</text>);
    const s6 = __SNAPSHOT__(<text>!</text>);

    const c0 = new SnapshotInstance(s3);
    const c1 = new SnapshotInstance(s3);
    b.insertBefore(c0);
    b.insertBefore(c1);

    const c0_d0 = new SnapshotInstance(s4);
    const c0_d1 = new SnapshotInstance(s5);
    const c0_d2 = new SnapshotInstance(s6);
    const c0_d0_ = new SnapshotInstance(s4);
    c0.insertBefore(c0_d0);
    c0.insertBefore(c0_d1);
    c0.insertBefore(c0_d2);
    c0.insertBefore(c0_d0_);

    const c1_d0 = new SnapshotInstance(s4);
    const c1_d1 = new SnapshotInstance(s5);
    const c1_d2 = new SnapshotInstance(s6);
    const c1_d0_ = new SnapshotInstance(s4);
    c1.insertBefore(c1_d0);
    c1.insertBefore(c1_d2);
    c1.insertBefore(c1_d1);
    c1.insertBefore(c1_d0_);

    __pendingListUpdates.flush();

    const component = [];
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);

    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "position": 0,
                  "type": "__Card__:__snapshot_a94a8_test_25",
                },
                {
                  "position": 1,
                  "type": "__Card__:__snapshot_a94a8_test_25",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      >
        <list-item>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
          <text>
            <raw-text
              text="World"
            />
          </text>
          <text>
            <raw-text
              text="!"
            />
          </text>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </list-item>
      </list>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
    expect(component[1]).toBe(component[0]);

    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "position": 0,
                  "type": "__Card__:__snapshot_a94a8_test_25",
                },
                {
                  "position": 1,
                  "type": "__Card__:__snapshot_a94a8_test_25",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      >
        <list-item>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
          <text>
            <raw-text
              text="!"
            />
          </text>
          <text>
            <raw-text
              text="World"
            />
          </text>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </list-item>
      </list>
    `);

    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
    expect(component[0]).toBe(component[1]);
  });

  it('should reuse and hydrate - item removed can be reused correctly', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const c0 = new SnapshotInstance(_s3);
    const c1 = new SnapshotInstance(_s3);
    const c2 = new SnapshotInstance(_s3);
    const c3 = new SnapshotInstance(_s3);
    const c4 = new SnapshotInstance(_s3);
    const c5 = new SnapshotInstance(_s3);

    [c0, c1, c2, c3, c4, c5].forEach(c => {
      const d0 = new SnapshotInstance(_s4);
      const d1 = new SnapshotInstance(_s4);
      const d2 = new SnapshotInstance(_s4);
      const d3 = new SnapshotInstance(_s4);

      c.insertBefore(d0);
      c.insertBefore(d1);
      c.insertBefore(d2);
      c.insertBefore(d3);
    });

    b.insertBefore(c0);
    b.insertBefore(c1);
    b.insertBefore(c2);
    b.insertBefore(c3);
    b.insertBefore(c4);
    b.insertBefore(c5);

    // item-key
    c0.setAttribute(0, { 'item-key': 'key-0' });
    c1.setAttribute(0, { 'item-key': 'key-1' });
    c2.setAttribute(0, { 'item-key': 'key-2' });
    c3.setAttribute(0, { 'item-key': 'key-3' });
    c4.setAttribute(0, { 'item-key': 'key-4' });
    c5.setAttribute(0, { 'item-key': 'key-5' });

    __pendingListUpdates.flush();

    const component = [];
    {
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2);
      component[3] = elementTree.triggerComponentAtIndex(listRef, 3);

      elementTree.triggerEnqueueComponent(listRef, component[0]);
      component[4] = elementTree.triggerComponentAtIndex(listRef, 4);
      expect(component[4]).toBe(component[0]);

      elementTree.triggerEnqueueComponent(listRef, component[1]);
      component[5] = elementTree.triggerComponentAtIndex(listRef, 5);
      expect(component[5]).toBe(component[1]);

      // should ignore
      elementTree.triggerEnqueueComponent(listRef, 99999);
    }

    b.removeChild(c3);
    __pendingListUpdates.flush();
    elementTree.triggerEnqueueComponent(listRef, component[3]);

    nativeMethodQueue.clear();
    component[1] = elementTree.triggerComponentAtIndex(listRef, 1);

    expect(nativeMethodQueue).toMatchInlineSnapshot(`
      [
        [
          "__SetAttribute",
          [
            <list-item
              item-key="key-1"
            >
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
            </list-item>,
            "item-key",
            "key-1",
          ],
        ],
        [
          "__FlushElementTree",
          [
            <list-item
              item-key="key-1"
            >
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
              <text>
                <raw-text
                  text="Hello"
                />
              </text>
            </list-item>,
            {
              "elementID": 31,
              "listID": 3,
              "operationID": undefined,
              "triggerLayout": true,
            },
          ],
        ],
      ]
    `);
  });

  it('should reuse and hydrate - with slot', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        {HOLE}!{HOLE}
      </list-item>,
    );
    const slot = __SNAPSHOT__(<view id='!'>{HOLE}</view>);

    const c0 = new SnapshotInstance(s3);
    const c1 = new SnapshotInstance(s3);
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
    component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
    elementTree.triggerEnqueueComponent(listRef, component[0]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
    expect(component[1]).toBe(component[0]);
    elementTree.triggerEnqueueComponent(listRef, component[1]);
    component[1] = elementTree.triggerComponentAtIndex(listRef, 0);
    expect(component[0]).toBe(component[1]);

    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "position": 0,
                  "type": "__Card__:__snapshot_a94a8_test_29",
                },
                {
                  "position": 1,
                  "type": "__Card__:__snapshot_a94a8_test_29",
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
      </list>
    `);
  });

  it('should handle continuous componentAtIndex on same index', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    // initial there is no child, because "update-list-info" is not flush
    expect(() => {
      elementTree.triggerComponentAtIndex(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: childCtx not found]`);

    // only call componentAtIndex after flush
    __pendingListUpdates.flush();
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`4`);
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`7`); // should return a new uiSign
  });

  it('should handle continuous componentAtIndex on same index - self reuse', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    // initial there is no child, because "update-list-info" is not flush
    expect(() => {
      elementTree.triggerComponentAtIndex(listRef, 0);
    }).toThrowErrorMatchingInlineSnapshot(`[Error: childCtx not found]`);

    // only call componentAtIndex after flush
    __pendingListUpdates.flush();
    let uiSign;
    expect(uiSign = elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`4`);
    elementTree.triggerEnqueueComponent(listRef, uiSign);
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`4`); // should reuse self
  });

  it('should handle componentAtIndex when `enableReuseNotification` is true', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d0 = new SnapshotInstance(s3);
    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    const d4 = new SnapshotInstance(s3);
    const d5 = new SnapshotInstance(s3);
    d0.setAttribute(0, { 'item-key': '0' });
    d1.setAttribute(0, { 'item-key': '1' });
    d2.setAttribute(0, { 'item-key': '2' });
    d3.setAttribute(0, { 'item-key': '3' });
    d4.setAttribute(0, { 'item-key': '4' });
    d5.setAttribute(0, { 'item-key': '5' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);
    b.insertBefore(d5);

    __pendingListUpdates.flush();

    const fn = vi.fn();
    const __original = globalThis.__FlushElementTree;
    globalThis.__FlushElementTree = (_, options = {}) => {
      const { elementID, listReuseNotification: { itemKey } = {} } = options;
      fn(elementID, itemKey);
    };

    {
      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0, undefined, true);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1, undefined, true);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2, undefined, true);
      component[3] = elementTree.triggerComponentAtIndex(listRef, 3, undefined, true);

      elementTree.triggerEnqueueComponent(listRef, component[0]);
      component[4] = elementTree.triggerComponentAtIndex(listRef, 4, undefined, true);
      expect(component[4]).toBe(component[0]);

      elementTree.triggerEnqueueComponent(listRef, component[1]);
      component[5] = elementTree.triggerComponentAtIndex(listRef, 5, undefined, true);
      expect(component[5]).toBe(component[1]);
    }

    globalThis.__FlushElementTree = __original;

    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          4,
          undefined,
        ],
        [
          7,
          undefined,
        ],
        [
          10,
          undefined,
        ],
        [
          13,
          undefined,
        ],
        [
          4,
          "4",
        ],
        [
          7,
          "5",
        ],
      ]
    `);
  });

  it('should handle componentAtIndex when there is `reuse-identifier`', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const d0 = new SnapshotInstance(s3);
    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    const d4 = new SnapshotInstance(s3);
    const d5 = new SnapshotInstance(s3);

    d0.setAttribute(0, { 'item-key': '0', 'reuse-identifier': 'a' });
    d1.setAttribute(0, { 'item-key': '1', 'reuse-identifier': 'a' });
    d2.setAttribute(0, { 'item-key': '2', 'reuse-identifier': 'a' });
    d3.setAttribute(0, { 'item-key': '3', 'reuse-identifier': 'b' });
    d4.setAttribute(0, { 'item-key': '4', 'reuse-identifier': 'b' });
    d5.setAttribute(0, { 'item-key': '5', 'reuse-identifier': 'b' });

    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);
    b.insertBefore(d5);

    __pendingListUpdates.flush();

    {
      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);

      elementTree.triggerEnqueueComponent(listRef, component[0]);

      // 3 cannot reuse 0, but 2 can
      component[3] = elementTree.triggerComponentAtIndex(listRef, 3);
      expect(component[3]).not.toBe(component[0]);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2);
      expect(component[2]).toBe(component[0]);

      elementTree.triggerEnqueueComponent(listRef, component[3]);
      // 5 can reuse 3
      component[5] = elementTree.triggerComponentAtIndex(listRef, 5);
      expect(component[5]).toBe(component[3]);
    }

    // reuse-identifier should not be visible from element
    expect(__FirstElement(listRef)).toMatchInlineSnapshot(`
      <list-item
        item-key="2"
      >
        <text>
          <raw-text
            text="World"
          />
        </text>
      </list-item>
    `);
  });
});

describe('list reload', () => {
  const s1 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  it('For same-type list-item with different item-key, do an insert + remove so the SDK detects it.', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__element_root;

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3); // a
    const d2 = new SnapshotInstance(s3); // b
    const d3 = new SnapshotInstance(s3); // c
    const d4 = new SnapshotInstance(s3); // d

    d1.setAttribute(0, { 'item-key': 'a' });
    d2.setAttribute(0, { 'item-key': 'b' });
    d3.setAttribute(0, { 'item-key': 'c' });
    d4.setAttribute(0, { 'item-key': 'd' });
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3); // a1
      const d2 = new SnapshotInstance(s3); // b1
      const d3 = new SnapshotInstance(s3); // c1
      const d4 = new SnapshotInstance(s3); // d1
      d1.setAttribute(0, { 'item-key': 'a1' });
      d2.setAttribute(0, { 'item-key': 'b1' });
      d3.setAttribute(0, { 'item-key': 'c1' });
      d4.setAttribute(0, { 'item-key': 'd1' });
      bb.insertBefore(d1);
      bb.insertBefore(d2);
      bb.insertBefore(d3);
      bb.insertBefore(d4);
    }

    hydrate(b, bb);
    b.unRenderElements();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "a",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "b",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "c",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "d",
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "item-key": "a1",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "b1",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "c1",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "item-key": "d1",
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                ],
                "removeAction": [
                  0,
                  1,
                  2,
                  3,
                ],
                "updateAction": [],
              },
            ]
          }
        />
      </view>
    `);
  });

  it('list-item with same type - remove', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__element_root;

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      bb.insertBefore(d1);
      bb.insertBefore(d2);
    }

    hydrate(b, bb);
    b.unRenderElements();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [
                  2,
                ],
                "updateAction": [],
              },
            ]
          }
        />
      </view>
    `);

    // go back to test insert
    hydrate(bb, b);
    bb.unRenderElements();
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [
                  2,
                ],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        />
      </view>
    `);
  });

  it('list-item with same type - move', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__element_root;

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const s4 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>Hello</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3); // a
    const d2 = new SnapshotInstance(s3); // b
    const d3 = new SnapshotInstance(s4); // c
    const d4 = new SnapshotInstance(s3); // d

    d1.setAttribute(0, { 'item-key': 'a' });
    d2.setAttribute(0, { 'item-key': 'b' });
    d3.setAttribute(0, { 'item-key': 'c' });
    d4.setAttribute(0, { 'item-key': 'd' });
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3); // a
      const d2 = new SnapshotInstance(s4); // c
      const d3 = new SnapshotInstance(s3); // b
      const d4 = new SnapshotInstance(s3); // d
      d1.setAttribute(0, { 'item-key': 'a' });
      d2.setAttribute(0, { 'item-key': 'c' });
      d3.setAttribute(0, { 'item-key': 'b' });
      d4.setAttribute(0, { 'item-key': 'd' });
      bb.insertBefore(d1);
      bb.insertBefore(d2);
      bb.insertBefore(d3);
      bb.insertBefore(d4);
    }

    hydrate(b, bb);
    b.unRenderElements();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "a",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_37",
                  },
                  {
                    "item-key": "b",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_37",
                  },
                  {
                    "item-key": "c",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_38",
                  },
                  {
                    "item-key": "d",
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_37",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "item-key": "b",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_37",
                  },
                ],
                "removeAction": [
                  1,
                ],
                "updateAction": [],
              },
            ]
          }
        />
      </view>
    `);
  });

  it('list-item with same type - with one list-item rendered', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__elements[0];
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    __pendingListUpdates.flush();
    elementTree.triggerComponentAtIndex(listRef, 0);

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      const d3 = new SnapshotInstance(s3);
      bb.insertBefore(d1);
      bb.insertBefore(d2);
      bb.insertBefore(d3);
    }

    hydrate(b, bb);
    b.unRenderElements();

    // The one rendered <list-item/> should be removed and reinserted
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_39",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_39",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_39",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        >
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
        </list>
      </view>
    `);
  });

  it('list-item with same type - platformInfo change', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__elements[0];
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    d1.setAttribute(0, { 'item-key': '1', 'full-span': true });
    d2.setAttribute(0, { 'item-key': '2', 'full-span': true });
    d3.setAttribute(0, { 'item-key': '3', 'full-span': true });
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      const d3 = new SnapshotInstance(s3);
      d1.setAttribute(0, { 'item-key': '1', 'full-span': true });
      d2.setAttribute(0, { 'item-key': '2', 'full-span': false });
      d3.setAttribute(0, { 'item-key': '3', 'full-span': true });
      bb.insertBefore(d1);
      bb.insertBefore(d2);
      bb.insertBefore(d3);
    }

    hydrate(b, bb);
    b.unRenderElements();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "full-span": true,
                    "item-key": "1",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_40",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_40",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_40",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [],
                "updateAction": [
                  {
                    "flush": false,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "to": 1,
                    "type": "__Card__:__snapshot_a94a8_test_40",
                  },
                ],
              },
            ]
          }
        />
      </view>
    `);
  });

  it('list-item with different type', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__elements[0];
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const s3_alt = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>W0r1d</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    const d4 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);

    __pendingListUpdates.flush();
    const uiSign0 = elementTree.triggerComponentAtIndex(listRef, 0);
    elementTree.triggerComponentAtIndex(listRef, 1); // make a rendered list-item
    const uiSign2 = elementTree.triggerComponentAtIndex(listRef, 2);
    elementTree.triggerEnqueueComponent(listRef, uiSign2); // make a rendered list-item which is enqueued

    const listID = __GetElementUniqueID(listRef);
    const signMap = gSignMap[listID];
    const recycleMap = gRecycleMap[listID];
    const recycleSignMap = recycleMap.get(s3);

    expect(signMap.get(__GetElementUniqueID(d1.__element_root))).toBe(d1);
    expect(signMap.get(__GetElementUniqueID(d2.__element_root))).toBe(d2);
    expect(signMap.get(__GetElementUniqueID(d3.__element_root))).toBe(d3);
    expect(recycleSignMap.get(__GetElementUniqueID(d3.__element_root))).toBe(d3);

    const bb = new SnapshotInstance(s1);
    const d1_ = new SnapshotInstance(s3_alt);
    const d2_ = new SnapshotInstance(s3);
    const d3_ = new SnapshotInstance(s3);
    const d4_ = new SnapshotInstance(s3);
    bb.insertBefore(d1_);
    bb.insertBefore(d2_);
    bb.insertBefore(d3_);
    bb.insertBefore(d4_);

    hydrate(b, bb);
    b.unRenderElements();

    // Should only update `list-item` in the recycling pool
    // Should not add the on-screen `list-item` to the recycling pool,
    expect([...recycleSignMap.keys()]).toStrictEqual([__GetElementUniqueID(d3.__element_root)]);
    expect(recycleSignMap.get(__GetElementUniqueID(d3.__element_root))).not.toBe(d3);

    // The one rendered <list-item/> should be removed
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_42",
                  },
                ],
                "removeAction": [
                  3,
                ],
                "updateAction": [],
              },
            ]
          }
        >
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
        </list>
      </view>
    `);

    // simulate behaviors of Lynx Engine
    {
      // a enqueueComponent should be triggered because the removeAction above
      elementTree.triggerEnqueueComponent(listRef, uiSign0);
      // and a componentAtIndex should be triggered because of the insertAction above
      elementTree.triggerComponentAtIndex(listRef, 0);
    }
    // the pool should have two items now
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                  {
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_41",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_42",
                  },
                ],
                "removeAction": [
                  3,
                ],
                "updateAction": [],
              },
            ]
          }
        >
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="W0r1d"
              />
            </text>
          </list-item>
        </list>
      </view>
    `);

    expect(signMap.get(__GetElementUniqueID(d1_.__element_root))).toBe(d1_);
    expect(signMap.get(__GetElementUniqueID(d1.__element_root))).toBe(d2_); // note: d1 is reused by d2_
    expect(signMap.get(__GetElementUniqueID(d2_.__element_root))).toBe(d2_);
    expect(signMap.get(__GetElementUniqueID(d3_.__element_root))).toBe(d3_);
    // d1 was enqueued as well, so it should be in the recycling pool
    expect([...recycleSignMap.keys()]).toStrictEqual([
      __GetElementUniqueID(d3.__element_root),
      __GetElementUniqueID(d1.__element_root),
    ]);
  });
});

describe('list hydrate', () => {
  it('should not modify values of old ctx', () => {
    const s1 = __SNAPSHOT__(<view attr={HOLE} />);

    const b = new SnapshotInstance(s1);
    b.ensureElements();
    b.setAttribute(0, '111');
    expect(b.__element_root).toMatchInlineSnapshot(`
      <view
        attr="111"
      />
    `);

    const bb = new SnapshotInstance(s1);
    bb.ensureElements();
    bb.setAttribute(0, '222');
    expect(bb.__element_root).toMatchInlineSnapshot(`
      <view
        attr="222"
      />
    `);

    hydrate(b, bb);
    expect(b.__values).toMatchInlineSnapshot(`
      [
        "111",
      ]
    `);
    expect(b.__element_root).toMatchInlineSnapshot(`
      <view
        attr="222"
      />
    `);
  });
});

describe('list bug', () => {
  const s = __SNAPSHOT__(
    <view>
      <text>Hello</text>
      {HOLE}
    </view>,
  );

  it(`"update-list-info" should have full "updateAction" under some condition`, async function() {
    SystemInfo.lynxSdkVersion = '2.16';

    const s1 = __SNAPSHOT__(
      <view>
        <text>111</text>
        <list custom-list-name='list-container'>{HOLE}</list>
      </view>,
    );
    const s2 = __SNAPSHOT__(<text>World</text>);
    const s3 = __SNAPSHOT__(
      <list-item item-key={1}>
        <text>World</text>
      </list-item>,
    );

    const a = new SnapshotInstance(s);
    a.ensureElements();

    const b = new SnapshotInstance(s1);
    const c = new SnapshotInstance(s2);

    a.insertBefore(b);
    a.insertBefore(c);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    expect(b.childNodes.length).toMatchInlineSnapshot(`3`);

    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-5": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
              {
                "position": 1,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
              {
                "position": 2,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
            ],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
              {
                "flush": false,
                "from": 1,
                "to": 1,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
              {
                "flush": false,
                "from": 2,
                "to": 2,
                "type": "__Card__:__snapshot_a94a8_test_47",
              },
            ],
          },
        ],
      }
    `);

    {
      __pendingListUpdates.clearAttachedLists();
      b.insertBefore(d3); // move
      expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
        {
          "-5": [
            {
              "insertAction": [
                {
                  "position": 2,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
              ],
              "removeAction": [
                2,
              ],
              "updateAction": [
                {
                  "flush": false,
                  "from": 0,
                  "to": 0,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
                {
                  "flush": false,
                  "from": 1,
                  "to": 1,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
                {
                  "flush": false,
                  "from": 2,
                  "to": 2,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
              ],
            },
          ],
        }
      `);
    }

    {
      __pendingListUpdates.clearAttachedLists();
      b.removeChild(d3); // move
      expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
        {
          "-5": [
            {
              "insertAction": [],
              "removeAction": [
                2,
              ],
              "updateAction": [
                {
                  "flush": false,
                  "from": 0,
                  "to": 0,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
                {
                  "flush": false,
                  "from": 1,
                  "to": 1,
                  "type": "__Card__:__snapshot_a94a8_test_47",
                },
              ],
            },
          ],
        }
      `);
    }

    SystemInfo.lynxSdkVersion = undefined;
  });
});

describe('list-item JSXSpread', () => {
  const s1 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  it('list-item with same type - platformInfo change', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__elements[0];
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(
      <list-item {...HOLE}>
        <text>World</text>
      </list-item>,
    );

    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      const d3 = new SnapshotInstance(s3);
      b.insertBefore(d1);
      b.insertBefore(d2);
      b.insertBefore(d3);

      d1.setAttribute(0, { 'item-key': '1', 'full-span': true, 'recyclable': true });
      d2.setAttribute(0, { 'item-key': '2', 'full-span': true, 'recyclable': true });
      d3.setAttribute(0, { 'item-key': '3', 'full-span': true, 'recyclable': true });
    }

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    bb.insertBefore(d1);
    bb.insertBefore(d2);
    bb.insertBefore(d3);

    d1.setAttribute(0, { 'item-key': '1', 'full-span': true, 'recyclable': false });
    d2.setAttribute(0, { 'item-key': '2', 'full-span': false, 'recyclable': false });
    d3.setAttribute(0, { 'item-key': '3', 'full-span': true, 'recyclable': false });

    hydrate(b, bb);
    b.unRenderElements();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "full-span": true,
                    "item-key": "1",
                    "position": 0,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [],
                "updateAction": [
                  {
                    "flush": false,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "recyclable": false,
                    "to": 0,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "recyclable": false,
                    "to": 1,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "recyclable": false,
                    "to": 2,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
              },
            ]
          }
        />
      </view>
    `);

    elementTree.triggerComponentAtIndex(listRef, 0);
    d1.setAttribute(0, { 'item-key': '1', 'full-span': true, 'sticky-top': 100 });
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "full-span": true,
                    "item-key": "1",
                    "position": 0,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [],
                "updateAction": [
                  {
                    "flush": false,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "recyclable": false,
                    "to": 0,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "recyclable": false,
                    "to": 1,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "recyclable": false,
                    "to": 2,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
              },
            ]
          }
        >
          <list-item
            full-span={true}
            item-key="1"
            sticky-top={100}
          >
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
        </list>
      </view>
    `);

    d1.setAttribute(0, { 'item-key': '1', 'full-span': true });
    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "full-span": true,
                    "item-key": "1",
                    "position": 0,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "recyclable": true,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [],
                "removeAction": [],
                "updateAction": [
                  {
                    "flush": false,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "recyclable": false,
                    "to": 0,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "recyclable": false,
                    "to": 1,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                  {
                    "flush": false,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "recyclable": false,
                    "to": 2,
                    "type": "__Card__:__snapshot_a94a8_test_49",
                  },
                ],
              },
            ]
          }
        >
          <list-item
            full-span={true}
            item-key="1"
            sticky-top={100}
          >
            <text>
              <raw-text
                text="World"
              />
            </text>
          </list-item>
        </list>
      </view>
    `);
  });
});

describe('list-item with platform info attributes', () => {
  const s1 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  const s3 = __SNAPSHOT__(
    <list-item
      item-key={HOLE}
      reuse-identifier={HOLE}
      full-span={HOLE}
      sticky-top={HOLE}
      sticky-bottom={HOLE}
      estimated-height={HOLE}
      estimated-height-px={HOLE}
      estimated-main-axis-size-px={HOLE}
      recyclable={HOLE}
    >
      <text>World</text>
    </list-item>,
  );

  it('basic list-item with platform info attributes', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__elements[0];
    const listRef = b.__elements[3];

    {
      const d0 = new SnapshotInstance(s3);
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      b.insertBefore(d0);
      b.insertBefore(d1);
      b.insertBefore(d2);

      d0.setAttribute(0, {
        'item-key': 'list-item-0',
        'reuse-identifier': 'A',
        'full-span': true,
        'sticky-top': true,
        'sticky-bottom': false,
        'estimated-height': 100,
        'estimated-height-px': 100,
        'estimated-main-axis-size-px': 100,
        'recyclable': false,
      });
      d1.setAttribute(0, {
        'item-key': 'list-item-1',
        'reuse-identifier': 'A',
        'full-span': false,
        'sticky-top': false,
        'sticky-bottom': false,
        'estimated-height': 100,
        'estimated-height-px': 100,
        'estimated-main-axis-size-px': 100,
        'recyclable': true,
      });
      d2.setAttribute(0, {
        'item-key': 'list-item-2',
        'reuse-identifier': 'A',
        'full-span': true,
        'sticky-top': false,
        'sticky-bottom': true,
        'estimated-height': 100,
        'estimated-height-px': 100,
        'estimated-main-axis-size-px': 100,
        'recyclable': false,
      });
    }

    __pendingListUpdates.flush();

    expect(root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="111"
          />
        </text>
        <list
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "estimated-height": 100,
                    "estimated-height-px": 100,
                    "estimated-main-axis-size-px": 100,
                    "full-span": true,
                    "item-key": "list-item-0",
                    "position": 0,
                    "recyclable": false,
                    "reuse-identifier": "A",
                    "sticky-bottom": false,
                    "sticky-top": true,
                    "type": "__Card__:__snapshot_a94a8_test_51",
                  },
                  {
                    "estimated-height": 100,
                    "estimated-height-px": 100,
                    "estimated-main-axis-size-px": 100,
                    "full-span": false,
                    "item-key": "list-item-1",
                    "position": 1,
                    "recyclable": true,
                    "reuse-identifier": "A",
                    "sticky-bottom": false,
                    "sticky-top": false,
                    "type": "__Card__:__snapshot_a94a8_test_51",
                  },
                  {
                    "estimated-height": 100,
                    "estimated-height-px": 100,
                    "estimated-main-axis-size-px": 100,
                    "full-span": true,
                    "item-key": "list-item-2",
                    "position": 2,
                    "recyclable": false,
                    "reuse-identifier": "A",
                    "sticky-bottom": true,
                    "sticky-top": false,
                    "type": "__Card__:__snapshot_a94a8_test_51",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        />
      </view>
    `);

    {
      elementTree.triggerComponentAtIndex(listRef, 0);
      elementTree.triggerComponentAtIndex(listRef, 1);
      elementTree.triggerComponentAtIndex(listRef, 2);
    }

    // All virtual attributes: recyclable and reuse-identifier should not be set to list-item element.
    expect(listRef).toMatchInlineSnapshot(`
      <list
        id="list"
        update-list-info={
          [
            {
              "insertAction": [
                {
                  "estimated-height": 100,
                  "estimated-height-px": 100,
                  "estimated-main-axis-size-px": 100,
                  "full-span": true,
                  "item-key": "list-item-0",
                  "position": 0,
                  "recyclable": false,
                  "reuse-identifier": "A",
                  "sticky-bottom": false,
                  "sticky-top": true,
                  "type": "__Card__:__snapshot_a94a8_test_51",
                },
                {
                  "estimated-height": 100,
                  "estimated-height-px": 100,
                  "estimated-main-axis-size-px": 100,
                  "full-span": false,
                  "item-key": "list-item-1",
                  "position": 1,
                  "recyclable": true,
                  "reuse-identifier": "A",
                  "sticky-bottom": false,
                  "sticky-top": false,
                  "type": "__Card__:__snapshot_a94a8_test_51",
                },
                {
                  "estimated-height": 100,
                  "estimated-height-px": 100,
                  "estimated-main-axis-size-px": 100,
                  "full-span": true,
                  "item-key": "list-item-2",
                  "position": 2,
                  "recyclable": false,
                  "reuse-identifier": "A",
                  "sticky-bottom": true,
                  "sticky-top": false,
                  "type": "__Card__:__snapshot_a94a8_test_51",
                },
              ],
              "removeAction": [],
              "updateAction": [],
            },
          ]
        }
      >
        <list-item
          estimated-height={100}
          estimated-height-px={100}
          estimated-main-axis-size-px={100}
          full-span={true}
          item-key="list-item-0"
          sticky-bottom={false}
          sticky-top={true}
        >
          <text>
            <raw-text
              text="World"
            />
          </text>
        </list-item>
        <list-item
          estimated-height={100}
          estimated-height-px={100}
          estimated-main-axis-size-px={100}
          full-span={false}
          item-key="list-item-1"
          sticky-bottom={false}
          sticky-top={false}
        >
          <text>
            <raw-text
              text="World"
            />
          </text>
        </list-item>
        <list-item
          estimated-height={100}
          estimated-height-px={100}
          estimated-main-axis-size-px={100}
          full-span={true}
          item-key="list-item-2"
          sticky-bottom={true}
          sticky-top={false}
        >
          <text>
            <raw-text
              text="World"
            />
          </text>
        </list-item>
      </list>
    `);
  });
});

describe('list componentAtIndexes', () => {
  const s0 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  const s1 = __SNAPSHOT__(
    <list-item item-key={HOLE}>
      <text>World</text>
    </list-item>,
  );

  it('basic componentAtIndexes with async flush', () => {
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__elements[3];

    const d0 = new SnapshotInstance(s1);
    const d1 = new SnapshotInstance(s1);
    const d2 = new SnapshotInstance(s1);
    d0.setAttribute(0, { 'item-key': 'list-item-0' });
    d1.setAttribute(0, { 'item-key': 'list-item-1' });
    d2.setAttribute(0, { 'item-key': 'list-item-2' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    __pendingListUpdates.flush();

    const fn = vi.fn();
    const __original = globalThis.__FlushElementTree;
    globalThis.__FlushElementTree = (_, options = {}) => {
      fn(options);
    };

    {
      const cellIndexes = [0, 1, 2];
      const operationIDs = [0, 1, 2];
      const enableReuseNotification = false;
      const asyncFlush = true;
      elementTree.triggerComponentAtIndexes(listRef, cellIndexes, operationIDs, enableReuseNotification, asyncFlush);
    }

    globalThis.__FlushElementTree = __original;
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "elementIDs": [
              4,
              7,
              10,
            ],
            "listID": 3,
            "operationIDs": [
              0,
              1,
              2,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);

    {
      const cellIndexes = [3];
      const operationIDs = [3];
      const enableReuseNotification = false;
      const asyncFlush = true;
      expect(() => {
        elementTree.triggerComponentAtIndexes(listRef, cellIndexes, operationIDs, enableReuseNotification, asyncFlush);
      }).toThrowErrorMatchingInlineSnapshot(`[Error: childCtx not found]`);
    }
  });

  it('basic componentAtIndexes with no async flush', () => {
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__elements[3];

    const d0 = new SnapshotInstance(s1);
    const d1 = new SnapshotInstance(s1);
    const d2 = new SnapshotInstance(s1);
    d0.setAttribute(0, { 'item-key': 'list-item-0' });
    d1.setAttribute(0, { 'item-key': 'list-item-1' });
    d2.setAttribute(0, { 'item-key': 'list-item-2' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    __pendingListUpdates.flush();

    const fn = vi.fn();
    const __original = globalThis.__FlushElementTree;
    globalThis.__FlushElementTree = (_, options = {}) => {
      fn(options);
    };

    {
      const cellIndexes = [0, 1, 2];
      const enableReuseNotification = false;
      const asyncFlush = false;
      elementTree.triggerComponentAtIndexes(listRef, cellIndexes, [11, 22, 33], enableReuseNotification, asyncFlush);
    }

    globalThis.__FlushElementTree = __original;
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "elementIDs": [
              4,
              7,
              10,
            ],
            "listID": 3,
            "operationIDs": [
              11,
              22,
              33,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);
  });

  it('basic componentAtIndexes with async flush and `enableReuseNotification` is true', () => {
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__elements[3];
    const d0 = new SnapshotInstance(s1);
    const d1 = new SnapshotInstance(s1);
    const d2 = new SnapshotInstance(s1);
    const d3 = new SnapshotInstance(s1);
    const d4 = new SnapshotInstance(s1);
    const d5 = new SnapshotInstance(s1);
    d0.setAttribute(0, { 'item-key': 'list-item-0' });
    d1.setAttribute(0, { 'item-key': 'list-item-1' });
    d2.setAttribute(0, { 'item-key': 'list-item-2' });
    d3.setAttribute(0, { 'item-key': 'list-item-3' });
    d4.setAttribute(0, { 'item-key': 'list-item-4' });
    d5.setAttribute(0, { 'item-key': 'list-item-5' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);
    b.insertBefore(d5);
    __pendingListUpdates.flush();

    {
      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2);
      elementTree.triggerEnqueueComponent(listRef, component[0]);
      elementTree.triggerEnqueueComponent(listRef, component[1]);
      elementTree.triggerEnqueueComponent(listRef, component[2]);
    }

    const fn = vi.fn();
    const __original = globalThis.__FlushElementTree;
    globalThis.__FlushElementTree = (_, options = {}) => {
      const { listReuseNotification } = options;
      if (listReuseNotification !== undefined) {
        listReuseNotification['listElement'] = undefined;
      }
      fn(options);
    };

    {
      const cellIndexes = [3, 4, 5];
      const operationIDs = [3, 4, 5];
      const enableReuseNotification = true;
      const asyncFlush = true;
      elementTree.triggerComponentAtIndexes(listRef, cellIndexes, operationIDs, enableReuseNotification, asyncFlush);
    }

    globalThis.__FlushElementTree = __original;
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "asyncFlush": true,
            "listReuseNotification": {
              "itemKey": "list-item-3",
              "listElement": undefined,
            },
          },
        ],
        [
          {
            "asyncFlush": true,
            "listReuseNotification": {
              "itemKey": "list-item-4",
              "listElement": undefined,
            },
          },
        ],
        [
          {
            "asyncFlush": true,
            "listReuseNotification": {
              "itemKey": "list-item-5",
              "listElement": undefined,
            },
          },
        ],
        [
          {
            "elementIDs": [
              4,
              7,
              10,
            ],
            "listID": 3,
            "operationIDs": [
              3,
              4,
              5,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);
  });

  it('should handle continuous componentAtIndexes on same index - self reuse', () => {
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__elements[3];
    const d0 = new SnapshotInstance(s1);
    const d1 = new SnapshotInstance(s1);
    const d2 = new SnapshotInstance(s1);
    d0.setAttribute(0, { 'item-key': 'list-item-0' });
    d1.setAttribute(0, { 'item-key': 'list-item-1' });
    d2.setAttribute(0, { 'item-key': 'list-item-2' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    __pendingListUpdates.flush();

    {
      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
      component[2] = elementTree.triggerComponentAtIndex(listRef, 2);
      elementTree.triggerEnqueueComponent(listRef, component[0]);
      elementTree.triggerEnqueueComponent(listRef, component[1]);
      elementTree.triggerEnqueueComponent(listRef, component[2]);
    }

    const fn = vi.fn();
    const __original = globalThis.__FlushElementTree;
    globalThis.__FlushElementTree = (_, options = {}) => {
      fn(options);
    };

    {
      const cellIndexes = [0, 1, 2];
      const operationIDs = [0, 1, 2];
      const enableReuseNotification = false;
      const asyncFlush = true;
      elementTree.triggerComponentAtIndexes(listRef, cellIndexes, operationIDs, enableReuseNotification, asyncFlush);
    }

    globalThis.__FlushElementTree = __original;
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "asyncFlush": true,
          },
        ],
        [
          {
            "elementIDs": [
              4,
              7,
              10,
            ],
            "listID": 3,
            "operationIDs": [
              0,
              1,
              2,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);
  });

  it('should update signMap before __FlushElementTree', () => {
    const b = new SnapshotInstance(s0);
    b.ensureElements();
    const listRef = b.__elements[3];
    const d0 = new SnapshotInstance(s1);
    const d1 = new SnapshotInstance(s1);
    const d2 = new SnapshotInstance(s1);
    d0.setAttribute(0, { 'item-key': 'list-item-0' });
    d1.setAttribute(0, { 'item-key': 'list-item-1' });
    d2.setAttribute(0, { 'item-key': 'list-item-2' });
    b.insertBefore(d0);
    b.insertBefore(d1);
    b.insertBefore(d2);
    __pendingListUpdates.flush();

    const listID = __GetElementUniqueID(listRef);
    const signMap = gSignMap[listID];
    const recycleMap = gRecycleMap[listID];

    {
      const flushElementTreeSpy = vi.spyOn(globalThis, '__FlushElementTree');
      const signMapSetSpy = vi.spyOn(signMap, 'set');

      const component = [];
      component[0] = elementTree.triggerComponentAtIndex(listRef, 0);
      component[1] = elementTree.triggerComponentAtIndex(listRef, 1);
      elementTree.triggerEnqueueComponent(listRef, component[0]);
      elementTree.triggerEnqueueComponent(listRef, component[1]);
      // no reuse occurs
      expect(signMapSetSpy).toHaveBeenCalled();
      expect(flushElementTreeSpy).toHaveBeenCalled();
      expect(signMapSetSpy.mock.invocationCallOrder[0])
        .toBeLessThan(flushElementTreeSpy.mock.invocationCallOrder[0]);

      flushElementTreeSpy.mockRestore();
      signMapSetSpy.mockRestore();
    }

    // re-spy
    const flushElementTreeSpy = vi.spyOn(globalThis, '__FlushElementTree');
    const signMapSetSpy = vi.spyOn(signMap, 'set');
    const recycleSignMap = recycleMap.get(s1);
    expect(Array.from(recycleSignMap.keys()).length).toBe(2);
    // reuse occurs
    elementTree.triggerComponentAtIndex(listRef, 2);
    expect(signMapSetSpy).toHaveBeenCalled();
    expect(flushElementTreeSpy).toHaveBeenCalled();
    expect(signMapSetSpy.mock.invocationCallOrder[0])
      .toBeLessThan(flushElementTreeSpy.mock.invocationCallOrder[0]);

    flushElementTreeSpy.mockRestore();
    signMapSetSpy.mockRestore();
  });
});

describe('list-item with "defer" attribute', () => {
  beforeEach(() => {
    globalEnvManager.resetEnv();
    elementTree.clear();
    vi.useFakeTimers();
  });

  it('basic deferred <list-item/>', async () => {
    const _F1 = vi.fn();

    const jsx = (
      <list id='list' custom-list-name='list-container'>
        <list-item item-key='1' defer>
          <_F1 />
        </list-item>
      </list>
    );
    const child = __SNAPSHOT__(<text>Hello World</text>);

    __root.__jsx = jsx;

    renderPage();

    expect(_F1).toBeCalledTimes(0);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <list
          custom-list-name="list-container"
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "1",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_55",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        />
      </page>
    `);

    __pendingListUpdates.flush();

    const listRef = elementTree.getElementById('list');
    elementTree.triggerComponentAtIndex(listRef, 0);

    const p = __root.__firstChild.__firstChild.__extraProps['isReady'];
    __root.__firstChild.__firstChild.__extraProps['isReady'] = 1;
    __root.__firstChild.__firstChild.insertBefore(new SnapshotInstance(child));
    const uiSign = await p;

    expect(uiSign).toBeTypeOf('number');
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <list
          custom-list-name="list-container"
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "1",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_55",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        >
          <list-item
            item-key="1"
          >
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </list-item>
        </list>
      </page>
    `);
  });

  it('basic deferred <list-item/> - componentAtIndex continuously should throw', async () => {
    const _F1 = vi.fn();

    const jsx = (
      <list id='list' custom-list-name='list-container'>
        <list-item item-key='1' defer>
          <_F1 />
        </list-item>
      </list>
    );
    __root.__jsx = jsx;

    renderPage();
    __pendingListUpdates.flush();

    const listRef = elementTree.getElementById('list');
    elementTree.triggerComponentAtIndex(listRef, 0, 11);
    expect(() => elementTree.triggerComponentAtIndex(listRef, 0, 22)).toThrowErrorMatchingInlineSnapshot(
      `[Error: componentAtIndex was called on a pending deferred list item]`,
    );
  });

  it('basic deferred <list-item/> - componentAtIndexes', async () => {
    const _F1 = vi.fn();

    const jsx = (
      <list id='list' custom-list-name='list-container'>
        <list-item item-key='0'>
          <_F1 />
        </list-item>
        <list-item item-key='1' defer>
          <_F1 />
        </list-item>
        <list-item item-key='2' defer>
          <_F1 />
        </list-item>
      </list>
    );
    __root.__jsx = jsx;

    renderPage();
    __pendingListUpdates.flush();

    const listRef = elementTree.getElementById('list');
    const __FlushElementTree = vi.fn();
    vi.stubGlobal('__FlushElementTree', __FlushElementTree);
    elementTree.triggerComponentAtIndexes(listRef, [0, 1, 2], [11, 22, 33], false, true);

    // a list-item which is not deferred should trigger two flush
    expect(__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            item-key="0"
          />,
          {
            "asyncFlush": true,
          },
        ],
        [
          <list
            custom-list-name="list-container"
            id="list"
            update-list-info={
              [
                {
                  "insertAction": [
                    {
                      "item-key": "0",
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_60",
                    },
                    {
                      "item-key": "1",
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_61",
                    },
                    {
                      "item-key": "2",
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_62",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key="0"
            />
          </list>,
          {
            "elementIDs": [
              2,
              -1,
              -1,
            ],
            "listID": 1,
            "operationIDs": [
              11,
              22,
              33,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);
    __FlushElementTree.mockClear();

    const ps = __root.__firstChild.childNodes.map(c => c.__extraProps?.['isReady']);

    __root.__firstChild.childNodes[1].__extraProps['isReady'] = 1;
    __root.__firstChild.childNodes[2].__extraProps['isReady'] = 1;

    await Promise.all(ps);
    expect(__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
      [
        [
          <list-item
            item-key="1"
          />,
          {
            "elementID": 3,
            "listID": 1,
            "operationID": 22,
            "triggerLayout": true,
          },
        ],
        [
          <list-item
            item-key="2"
          />,
          {
            "elementID": 4,
            "listID": 1,
            "operationID": 33,
            "triggerLayout": true,
          },
        ],
        [
          <list
            custom-list-name="list-container"
            id="list"
            update-list-info={
              [
                {
                  "insertAction": [
                    {
                      "item-key": "0",
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_60",
                    },
                    {
                      "item-key": "1",
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_61",
                    },
                    {
                      "item-key": "2",
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_62",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key="0"
            />
            <list-item
              item-key="1"
            />
            <list-item
              item-key="2"
            />
          </list>,
          {
            "elementIDs": [
              2,
              3,
              4,
            ],
            "listID": 1,
            "operationIDs": [
              11,
              22,
              33,
            ],
            "triggerLayout": true,
          },
        ],
      ]
    `);
  });

  it('basic deferred <list-item/> - should unmount when reused', async () => {
    const _F1 = vi.fn();

    const child = __SNAPSHOT__(<text>Hello World</text>);
    const jsx = (
      <list id='list' custom-list-name='list-container'>
        {[0, 1, 2].map((v) => (
          <list-item item-key={`${v}`} defer>
            <_F1 />
          </list-item>
        ))}
      </list>
    );

    __root.__jsx = jsx;

    renderPage();

    expect(_F1).toBeCalledTimes(0);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <list
          custom-list-name="list-container"
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "0",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                  {
                    "item-key": "1",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                  {
                    "item-key": "2",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        />
      </page>
    `);

    __pendingListUpdates.flush();

    const listRef = elementTree.getElementById('list');
    elementTree.triggerComponentAtIndex(listRef, 0);

    const p = __root.__firstChild.__firstChild.__extraProps['isReady'];
    __root.__firstChild.__firstChild.__extraProps['isReady'] = 1;
    __root.__firstChild.__firstChild.insertBefore(new SnapshotInstance(child));
    const uiSign = await p;

    expect(uiSign).toBeTypeOf('number');
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <list
          custom-list-name="list-container"
          id="list"
          update-list-info={
            [
              {
                "insertAction": [
                  {
                    "item-key": "0",
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                  {
                    "item-key": "1",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                  {
                    "item-key": "2",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_65",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
            ]
          }
        >
          <list-item
            item-key="0"
          >
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </list-item>
        </list>
      </page>
    `);

    elementTree.triggerEnqueueComponent(listRef, uiSign);

    {
      globalThis.__OnLifecycleEvent.mockClear();
      elementTree.triggerComponentAtIndex(listRef, 1);
      const item = __root.__firstChild.__firstChild.__nextSibling;
      const p = item.__extraProps['isReady'];
      item.__extraProps['isReady'] = 1;
      item.insertBefore(new SnapshotInstance(child));
      const uiSign2 = await p;

      expect(uiSign2).toBeTypeOf('number');
      expect(uiSign2).toBe(uiSign);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <list
            custom-list-name="list-container"
            id="list"
            update-list-info={
              [
                {
                  "insertAction": [
                    {
                      "item-key": "0",
                      "position": 0,
                      "type": "__Card__:__snapshot_a94a8_test_65",
                    },
                    {
                      "item-key": "1",
                      "position": 1,
                      "type": "__Card__:__snapshot_a94a8_test_65",
                    },
                    {
                      "item-key": "2",
                      "position": 2,
                      "type": "__Card__:__snapshot_a94a8_test_65",
                    },
                  ],
                  "removeAction": [],
                  "updateAction": [],
                },
              ]
            }
          >
            <list-item
              item-key="1"
            >
              <text>
                <raw-text
                  text="Hello World"
                />
              </text>
            </list-item>
          </list>
        </page>
      `);

      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxPublishEvent",
              {
                "data": {},
                "handlerName": "-7:__extraProps:onComponentAtIndex",
              },
            ],
          ],
          [
            [
              "rLynxPublishEvent",
              {
                "data": {},
                "handlerName": "-5:__extraProps:onRecycleComponent",
              },
            ],
          ],
        ]
      `);
    }
  });

  it('should throw without custom-list-name="list-container"', async () => {
    const _F1 = vi.fn();

    const jsx = (
      <list id='list'>
        {[0, 1, 2].map((v) => (
          <list-item item-key={`${v}`} defer>
            <_F1 />
          </list-item>
        ))}
      </list>
    );

    __root.__jsx = jsx;

    renderPage();

    expect(_F1).toBeCalledTimes(0);

    __pendingListUpdates.flush();

    const listRef = elementTree.getElementById('list');
    expect(() => elementTree.triggerComponentAtIndex(listRef, 0)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unsupported: \`<list-item/>\` with \`defer={true}\` must be used with \`<list custom-list-name="list-container"/>\`]`,
    );
  });
});

describe('nested list', () => {
  const s = __SNAPSHOT__(
    <view>
      <text>Hello</text>
      {HOLE}
    </view>,
  );

  it('nested list should work', () => {
    const s1 = __SNAPSHOT__(
      <view>
        <text>s1</text>
        <list>{HOLE}</list>
      </view>,
    );
    const s2 = __SNAPSHOT__(
      <list-item>
        <text>s2</text>
        <list>{HOLE}</list>
      </list-item>,
    );
    const s3 = __SNAPSHOT__(
      <list-item>
        <text>s3</text>
      </list-item>,
    );

    const a = new SnapshotInstance(s);

    const b = new SnapshotInstance(s1);
    a.insertBefore(b);
    b.ensureElements();
    const parentListRef = b.__elements[3];

    const c1 = new SnapshotInstance(s2);
    const c2 = new SnapshotInstance(s2);
    const c3 = new SnapshotInstance(s2);
    b.insertBefore(c1);
    b.insertBefore(c2);
    b.insertBefore(c3);

    const d1 = new SnapshotInstance(s3);
    c1.insertBefore(d1);

    const d2 = new SnapshotInstance(s3);
    c2.insertBefore(d2);

    const d3 = new SnapshotInstance(s3);
    c3.insertBefore(d3);

    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-5": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_70",
              },
              {
                "position": 1,
                "type": "__Card__:__snapshot_a94a8_test_70",
              },
              {
                "position": 2,
                "type": "__Card__:__snapshot_a94a8_test_70",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
        "-6": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
        "-7": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
        "-8": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
      }
    `);
    expect(parentListRef).toMatchInlineSnapshot(`<list />`);

    __pendingListUpdates.flush();
    // children list should not be cleared
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-6": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
        "-7": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
        "-8": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_71",
              },
            ],
            "removeAction": [],
            "updateAction": [],
          },
        ],
      }
    `);

    expect(elementTree.triggerComponentAtIndex(parentListRef, 0)).toMatchInlineSnapshot(`4`);
    expect(elementTree.triggerComponentAtIndex(parentListRef, 1)).toMatchInlineSnapshot(`8`);
    expect(elementTree.triggerComponentAtIndex(parentListRef, 2)).toMatchInlineSnapshot(`12`);

    __pendingListUpdates.flush();
    // all lists should be cleared
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`{}`);

    const childListRef1 = c1.__elements[3];
    const childListRef2 = c2.__elements[3];
    const childListRef3 = c3.__elements[3];
    expect(elementTree.triggerComponentAtIndex(childListRef1, 0)).toMatchInlineSnapshot(`16`);
    expect(elementTree.triggerComponentAtIndex(childListRef2, 0)).toMatchInlineSnapshot(`19`);
    expect(elementTree.triggerComponentAtIndex(childListRef3, 0)).toMatchInlineSnapshot(`22`);

    expect(elementTree).toMatchInlineSnapshot(`
      "<view>
        <text>
          <raw-text
            text="s1"
          />
        </text>
        <list
          update-list-info={
            Array [
              Object {
                "insertAction": Array [
                  Object {
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_70",
                  },
                  Object {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_70",
                  },
                  Object {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_70",
                  },
                ],
                "removeAction": Array [],
                "updateAction": Array [],
              },
            ]
          }
        >
          <list-item>
            <text>
              <raw-text
                text="s2"
              />
            </text>
            <list
              update-list-info={
                Array [
                  Object {
                    "insertAction": Array [
                      Object {
                        "position": 0,
                        "type": "__Card__:__snapshot_a94a8_test_71",
                      },
                    ],
                    "removeAction": Array [],
                    "updateAction": Array [],
                  },
                ]
              }
            >
              <list-item>
                <text>
                  <raw-text
                    text="s3"
                  />
                </text>
              </list-item>
            </list>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="s2"
              />
            </text>
            <list
              update-list-info={
                Array [
                  Object {
                    "insertAction": Array [
                      Object {
                        "position": 0,
                        "type": "__Card__:__snapshot_a94a8_test_71",
                      },
                    ],
                    "removeAction": Array [],
                    "updateAction": Array [],
                  },
                ]
              }
            >
              <list-item>
                <text>
                  <raw-text
                    text="s3"
                  />
                </text>
              </list-item>
            </list>
          </list-item>
          <list-item>
            <text>
              <raw-text
                text="s2"
              />
            </text>
            <list
              update-list-info={
                Array [
                  Object {
                    "insertAction": Array [
                      Object {
                        "position": 0,
                        "type": "__Card__:__snapshot_a94a8_test_71",
                      },
                    ],
                    "removeAction": Array [],
                    "updateAction": Array [],
                  },
                ]
              }
            >
              <list-item>
                <text>
                  <raw-text
                    text="s3"
                  />
                </text>
              </list-item>
            </list>
          </list-item>
        </list>
      </view>"
    `);
  });

  it('should clear attached lists & should flush during ensureElements', () => {
    const s1 = __SNAPSHOT__(
      <view>
        <text>s1</text>
        <list>{HOLE}</list>
      </view>,
    );
    const s2 = __SNAPSHOT__(
      <list-item>
        <text>s2</text>
        <list>{HOLE}</list>
      </list-item>,
    );
    const s3 = __SNAPSHOT__(
      <list-item>
        <text>s3</text>
      </list-item>,
    );

    const a = new SnapshotInstance(s);

    const b = new SnapshotInstance(s1);
    a.insertBefore(b);
    b.ensureElements();

    const c1 = new SnapshotInstance(s2);
    const c2 = new SnapshotInstance(s2);
    const c3 = new SnapshotInstance(s2);
    b.insertBefore(c1);
    b.insertBefore(c2);
    b.insertBefore(c3);

    const d1 = new SnapshotInstance(s3);
    c1.insertBefore(d1);

    const d2 = new SnapshotInstance(s3);
    c2.insertBefore(d2);

    const d3 = new SnapshotInstance(s3);
    c3.insertBefore(d3);

    expect(Object.keys(__pendingListUpdates.values).length).toBe(4);

    __pendingListUpdates.clearAttachedLists();
    // should only clear the parent list
    expect(Object.keys(__pendingListUpdates.values).length).toBe(3);

    // list-item will recursively ensureElements
    // if a list-item contains a nested list as its child,
    // that nested list should be flushed during ensureElements
    c1.ensureElements();
    expect(Object.keys(__pendingListUpdates.values).length).toBe(2);
  });
});

describe('update-list-info profile', () => {
  const s1 = __SNAPSHOT__(
    <view>
      <text>111</text>
      <list id='list'>{HOLE}</list>
    </view>,
  );

  it('flush & hydrate', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const root = b.__element_root;

    const s3 = __SNAPSHOT__(
      <list-item item-key={HOLE}>
        <text>World</text>
      </list-item>,
    );

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s3);
      bb.insertBefore(d1);
      bb.insertBefore(d2);
    }

    hydrate(b, bb);

    expect(lynx.performance.profileStart).toHaveBeenCalled();
    expect(lynx.performance.profileStart.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "ReactLynx::listFlush::updateListInfo",
          {
            "args": {
              "list id": "3",
              "update list info": "{"insertAction":[{"position":0,"type":"__Card__:__snapshot_a94a8_test_76"},{"position":1,"type":"__Card__:__snapshot_a94a8_test_76"},{"position":2,"type":"__Card__:__snapshot_a94a8_test_76"}],"removeAction":[],"updateAction":[]}",
            },
          },
        ],
        [
          "ReactLynx::listHydrate::updateListInfo",
          {
            "args": {
              "list id": "3",
              "update list info": "{"insertAction":[],"removeAction":[2],"updateAction":[]}",
            },
          },
        ],
      ]
    `);
  });
});
