/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';

const HOLE = null;

beforeEach(() => {
  snapshotInstanceManager.clear();
});

afterEach(() => {
  elementTree.clear();
});

it('basic', async function() {
  expect(
    __SNAPSHOT__(
      <view>
        <text>!!!</text>
        <text>{HOLE}</text>
      </view>,
    ),
  ).toMatchInlineSnapshot(`"__snapshot_a94a8_test_1"`);
});

const snapshot1 = __SNAPSHOT__(
  <view>
    <text>!!!</text>
    <text>{HOLE}</text>
  </view>,
);

const snapshot2 = __SNAPSHOT__(
  <view>
    <text>Hello World</text>
  </view>,
);

describe('insertBefore', () => {
  it('snapshot slot count = 1', async function() {
    const a = new SnapshotInstance(snapshot1);
    a.ensureElements();

    const b = new SnapshotInstance(snapshot2);
    const c = new SnapshotInstance(snapshot2);

    a.insertBefore(b);
    a.insertBefore(b);
    a.insertBefore(c, b);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <text>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
        </text>
      </view>
    `);
  });

  it('snapshot slot count = 2', async function() {
    const snapshot1 = __SNAPSHOT__(
      <view>
        <text>!!!</text>
        <text>
          {HOLE}!!!{HOLE}
        </text>
      </view>,
    );

    const snapshot2 = __SNAPSHOT__(
      <view>
        <text>Hello World</text>
      </view>,
    );

    const a = new SnapshotInstance(snapshot1);
    a.ensureElements();

    const b = new SnapshotInstance(snapshot2);
    const c = new SnapshotInstance(snapshot2);

    a.insertBefore(b);
    a.insertBefore(c);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <text>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
          <raw-text
            text="!!!"
          />
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
        </text>
      </view>
    `);
  });

  it('snapshot slot count = 2 - delayed ensureElements', async function() {
    const snapshot1 = __SNAPSHOT__(
      <view>
        <text>!!!</text>
        <text>
          {HOLE}!!!{HOLE}
        </text>
      </view>,
    );

    const snapshot2 = __SNAPSHOT__(
      <view>
        <text>Hello World</text>
      </view>,
    );

    const a = new SnapshotInstance(snapshot1);
    const b = new SnapshotInstance(snapshot2);
    const c = new SnapshotInstance(snapshot2);
    a.insertBefore(b);
    a.insertBefore(c);

    a.ensureElements();

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <text>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
          <raw-text
            text="!!!"
          />
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
        </text>
      </view>
    `);
  });
});

describe('removeChild', () => {
  it('snapshot slot count = 1', async function() {
    const a = new SnapshotInstance(snapshot1);
    a.ensureElements();

    const b = new SnapshotInstance(snapshot2);

    a.insertBefore(b);
    a.insertBefore(b);

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <text>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
          </view>
        </text>
      </view>
    `);

    expect(snapshotInstanceManager.values.size).toMatchInlineSnapshot(`2`);

    a.removeChild(b);
    expect(() => a.removeChild(b)).toThrowErrorMatchingInlineSnapshot(
      `[Error: The node to be removed is not a child of this node.]`,
    );

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="!!!"
          />
        </text>
        <text />
      </view>
    `);

    expect(snapshotInstanceManager.values.size).toMatchInlineSnapshot(`1`);
  });
});

const snapshot3 = __SNAPSHOT__(
  <view id={HOLE} className={HOLE} style={HOLE}>
    <text data-1={HOLE}>
      Hello World
      <raw-text text={HOLE} />
    </text>
    <view bindtap={HOLE} />
  </view>,
);

describe('setAttribute', () => {
  it('basic', () => {
    const a = new SnapshotInstance(snapshot3);
    a.ensureElements();

    a.setAttribute(0, 'id');
    {
      const pre = a.__snapshot_def.update[0];
      a.__snapshot_def.update[0] = vi.fn();
      a.setAttribute(0, 'id');
      expect(a.__snapshot_def.update[0]).toHaveBeenCalledTimes(0);
      a.__snapshot_def.update[0] = pre;
    }
    a.setAttribute(1, 'className');
    a.setAttribute(2, 'style');
    a.setAttribute(3, '1');
    a.setAttribute(4, null); // to cover unset attr
    a.setAttribute(4, 'text');
    a.setAttribute(5, ':2333:5');

    expect(() => __SetAttribute(a.__element_root, 'style', 'xxx'))
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: Cannot use __SetAttribute for "style"]`,
      );

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view
        class="className"
        id="id"
        style="style"
      >
        <text
          dataset={
            {
              "1": "1",
            }
          }
        >
          <raw-text
            text="Hello World"
          />
          <raw-text
            text="text"
          />
        </text>
        <view
          event={
            {
              "bindEvent:tap": ":2333:5",
            }
          }
        />
      </view>
    `);

    __AddEvent(a.__elements[4], 'bindEvent', 'tap', undefined);
    expect(() => __AddEvent(a.__elements[4], 'bindEvent', 'tap', function() {}))
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: event must be string, but got function]`,
      );
  });

  it('list platform info', () => {
    const snapshot4 = __SNAPSHOT__(
      <list-item
        item-key='111' // should not be static
        full-span={HOLE} // should be aggregated
        sticky-top={HOLE} // should be aggregated
        // normal
        className='xxx'
        style={HOLE}
      >
      </list-item>,
    );

    const a = new SnapshotInstance(snapshot4);
    a.ensureElements();

    a.setAttribute(0, { 'full-span': true });
    a.setAttribute(1, 'style');

    expect(a.__element_root).toMatchInlineSnapshot(`
      <list-item
        class="xxx"
        full-span={true}
        style="style"
      />
    `);
  });

  it('basic update', () => {
    const s = __SNAPSHOT__(<view className={HOLE}></view>);
    const a = new SnapshotInstance(s);
    a.ensureElements();

    a.setAttribute(0, 'class');
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view
        class="class"
      />
    `);
    a.setAttribute(0, 'clazz');
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view
        class="clazz"
      />
    `);
    a.setAttribute(0, null);
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view
        class=""
      />
    `);
  });
});

describe('dynamic key in snapshot', () => {
  it('multiple slots 0', () => {
    const snapshot = __SNAPSHOT__(
      <view>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>,
    );

    const a = new SnapshotInstance(snapshot);
    a.ensureElements();

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <view
          class="foo"
        >
          <wrapper />
        </view>
      </view>
    `);
  });

  it('multiple slots 2', () => {
    const snapshot = __SNAPSHOT__(
      <view className='foo' key={`foo`}>
        <view>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>,
    );

    const a = new SnapshotInstance(snapshot);
    a.ensureElements();

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view
        class="foo"
      >
        <wrapper />
      </view>
    `);
  });

  it('multiple slots 3', () => {
    const snapshot = __SNAPSHOT__(
      <view>
        <text>Hello {HOLE}</text>
        <view className='foo' key={`foo`}>
          <view>
            {<text>foo</text>}
          </view>
          <view>
            {<text>bar</text>}
          </view>
        </view>
      </view>,
    );

    const a = new SnapshotInstance(snapshot);
    a.ensureElements();

    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="Hello "
          />
          <wrapper />
        </text>
        <view
          class="foo"
        >
          <wrapper />
        </view>
      </view>
    `);
  });
});
