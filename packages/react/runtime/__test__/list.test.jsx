import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { hydrate } from '../src/hydrate';
import { __pendingListUpdates } from '../src/list';
import { SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';

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
        "-2": [
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
          "-2": [
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
          "-2": [
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

    d1.setAttribute('__0', { 'item-key': 1 });
    d3.setAttribute('__0', { 'item-key': 3 });
    expect(__pendingListUpdates.values).toMatchInlineSnapshot(`
      {
        "-1": [
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

    // only call componentAtIndx after flush
    __pendingListUpdates.flush();
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`46`);
    expect(elementTree.triggerComponentAtIndex(listRef, 1)).toMatchInlineSnapshot(`49`);
    expect(elementTree.triggerComponentAtIndex(listRef, 2)).toMatchInlineSnapshot(`52`);
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
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 0,
                  "item-key": "key-0",
                  "to": 0,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
            },
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 1,
                  "item-key": "key-1",
                  "to": 1,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
            },
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 2,
                  "item-key": "key-2",
                  "to": 2,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
            },
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 3,
                  "item-key": "key-3",
                  "to": 3,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
            },
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 4,
                  "item-key": "key-4",
                  "to": 4,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
            },
            {
              "insertAction": [],
              "removeAction": [],
              "updateAction": [
                {
                  "flush": false,
                  "from": 5,
                  "item-key": "key-5",
                  "to": 5,
                  "type": "__Card__:__snapshot_a94a8_test_21",
                },
              ],
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
                "bindEvent:tap": "-6:1:",
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
                "bindEvent:tap": "-7:1:",
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
                "bindEvent:tap": "-4:1:",
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
                "bindEvent:tap": "-5:1:",
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

  it('should reuse and hydrate - with childNodes', () => {
    const b = new SnapshotInstance(s1);
    b.ensureElements();
    const listRef = b.__elements[3];

    const s3 = __SNAPSHOT__(<list-item item-key={HOLE}>{HOLE}</list-item>);
    const s4 = __SNAPSHOT__(<text>Hello</text>);
    const s5 = __SNAPSHOT__(<text>World</text>);

    const c0 = new SnapshotInstance(s3);
    const c1 = new SnapshotInstance(s3);
    const c2 = new SnapshotInstance(s3);
    b.insertBefore(c0);
    b.insertBefore(c1);
    b.insertBefore(c2);

    const c0_d0 = new SnapshotInstance(s4);
    const c0_d1 = new SnapshotInstance(s5);
    c0.insertBefore(c0_d0);
    c0.insertBefore(c0_d1);

    const c1_d0 = new SnapshotInstance(s4);
    c1.insertBefore(c1_d0);

    const c2_d0 = new SnapshotInstance(s5);
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

    // only call componentAtIndx after flush
    __pendingListUpdates.flush();
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`119`);
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`122`); // should return a new uiSign
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

    // only call componentAtIndx after flush
    __pendingListUpdates.flush();
    let uiSign;
    expect(uiSign = elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`129`);
    elementTree.triggerEnqueueComponent(listRef, uiSign);
    expect(elementTree.triggerComponentAtIndex(listRef, 0)).toMatchInlineSnapshot(`129`); // should reuse self
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
          136,
          undefined,
        ],
        [
          139,
          undefined,
        ],
        [
          142,
          undefined,
        ],
        [
          145,
          undefined,
        ],
        [
          136,
          "4",
        ],
        [
          139,
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

    // reuse-identifier should not be visiable from element
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
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_35",
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
                "updateAction": [
                  {
                    "flush": true,
                    "from": 0,
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "to": 1,
                  },
                ],
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
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_35",
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
                "updateAction": [
                  {
                    "flush": true,
                    "from": 0,
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "to": 1,
                  },
                ],
              },
              {
                "insertAction": [
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_35",
                  },
                ],
                "removeAction": [],
                "updateAction": [
                  {
                    "flush": true,
                    "from": 0,
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "to": 1,
                  },
                ],
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

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s4);
    const d4 = new SnapshotInstance(s3);
    b.insertBefore(d1);
    b.insertBefore(d2);
    b.insertBefore(d3);
    b.insertBefore(d4);

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);
    {
      const d1 = new SnapshotInstance(s3);
      const d2 = new SnapshotInstance(s4);
      const d3 = new SnapshotInstance(s3);
      const d4 = new SnapshotInstance(s3);
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
                    "position": 0,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_37",
                  },
                  {
                    "position": 3,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                ],
                "removeAction": [],
                "updateAction": [],
              },
              {
                "insertAction": [
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_36",
                  },
                ],
                "removeAction": [
                  1,
                ],
                "updateAction": [
                  {
                    "flush": true,
                    "from": 0,
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "to": 2,
                  },
                  {
                    "flush": true,
                    "from": 3,
                    "to": 3,
                  },
                ],
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
                    "type": "__Card__:__snapshot_a94a8_test_38",
                  },
                  {
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_38",
                  },
                  {
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_38",
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
                    "flush": true,
                    "from": 0,
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "to": 2,
                  },
                ],
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
                    "type": "__Card__:__snapshot_a94a8_test_39",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_39",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
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
                "updateAction": [
                  {
                    "flush": true,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "to": 2,
                  },
                ],
              },
            ]
          }
        />
      </view>
    `);
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
        "-2": [
          {
            "insertAction": [
              {
                "position": 0,
                "type": "__Card__:__snapshot_a94a8_test_44",
              },
              {
                "position": 1,
                "type": "__Card__:__snapshot_a94a8_test_44",
              },
              {
                "position": 2,
                "type": "__Card__:__snapshot_a94a8_test_44",
              },
            ],
            "removeAction": [],
            "updateAction": [
              {
                "flush": false,
                "from": 0,
                "to": 0,
                "type": "__Card__:__snapshot_a94a8_test_44",
              },
              {
                "flush": false,
                "from": 1,
                "to": 1,
                "type": "__Card__:__snapshot_a94a8_test_44",
              },
              {
                "flush": false,
                "from": 2,
                "to": 2,
                "type": "__Card__:__snapshot_a94a8_test_44",
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
          "-2": [
            {
              "insertAction": [
                {
                  "position": 2,
                  "type": "__Card__:__snapshot_a94a8_test_44",
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
                  "type": "__Card__:__snapshot_a94a8_test_44",
                },
                {
                  "flush": false,
                  "from": 1,
                  "to": 1,
                  "type": "__Card__:__snapshot_a94a8_test_44",
                },
                {
                  "flush": false,
                  "from": 2,
                  "to": 2,
                  "type": "__Card__:__snapshot_a94a8_test_44",
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
          "-2": [
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
                  "type": "__Card__:__snapshot_a94a8_test_44",
                },
                {
                  "flush": false,
                  "from": 1,
                  "to": 1,
                  "type": "__Card__:__snapshot_a94a8_test_44",
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

      d1.setAttribute(0, { 'item-key': '1', 'full-span': true });
      d2.setAttribute(0, { 'item-key': '2', 'full-span': true });
      d3.setAttribute(0, { 'item-key': '3', 'full-span': true });
    }

    __pendingListUpdates.flush();

    const bb = new SnapshotInstance(s1);

    const d1 = new SnapshotInstance(s3);
    const d2 = new SnapshotInstance(s3);
    const d3 = new SnapshotInstance(s3);
    bb.insertBefore(d1);
    bb.insertBefore(d2);
    bb.insertBefore(d3);

    d1.setAttribute(0, { 'item-key': '1', 'full-span': true });
    d2.setAttribute(0, { 'item-key': '2', 'full-span': false });
    d3.setAttribute(0, { 'item-key': '3', 'full-span': true });

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
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_46",
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
                    "flush": true,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "to": 2,
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
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_46",
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
                    "flush": true,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "to": 2,
                  },
                ],
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
                    "to": 0,
                    "type": "__Card__:__snapshot_a94a8_test_46",
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
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "2",
                    "position": 1,
                    "type": "__Card__:__snapshot_a94a8_test_46",
                  },
                  {
                    "full-span": true,
                    "item-key": "3",
                    "position": 2,
                    "type": "__Card__:__snapshot_a94a8_test_46",
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
                    "flush": true,
                    "from": 0,
                    "full-span": true,
                    "item-key": "1",
                    "to": 0,
                  },
                  {
                    "flush": true,
                    "from": 1,
                    "full-span": false,
                    "item-key": "2",
                    "to": 1,
                  },
                  {
                    "flush": true,
                    "from": 2,
                    "full-span": true,
                    "item-key": "3",
                    "to": 2,
                  },
                ],
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
                    "to": 0,
                    "type": "__Card__:__snapshot_a94a8_test_46",
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
