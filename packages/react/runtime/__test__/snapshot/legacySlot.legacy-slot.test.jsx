/*
// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

// This suite is compiled with the legacy children + wrapper codegen
// (`compat.legacySlot`, see vitest.config.ts) and asserts that the current
// runtime renders/updates legacy-slot snapshots correctly.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot';

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
    b.__slotIndex = 0;
    c.__slotIndex = 1;

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

  it('keeps __current_slot_index stable when removing content inside slot wrappers', async function() {
    const snapshot1 = __SNAPSHOT__(
      <view>
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

    // Insert two wrappers for stable slot index
    const b = new SnapshotInstance('wrapper');
    const c = new SnapshotInstance('wrapper');
    expect(a.__current_slot_index).toBe(0);
    a.insertBefore(b);
    expect(a.__current_slot_index).toBe(1);
    a.insertBefore(c);
    expect(a.__current_slot_index).toBe(2);
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <wrapper />
          <raw-text
            text="!!!"
          />
          <wrapper />
        </text>
      </view>
    `);

    const d = new SnapshotInstance(snapshot2);
    const e = new SnapshotInstance(snapshot2);

    b.insertBefore(d);
    c.insertBefore(e);

    expect(a.__current_slot_index).toBe(2);
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <wrapper>
            <view>
              <text>
                <raw-text
                  text="Hello World"
                />
              </text>
            </view>
          </wrapper>
          <raw-text
            text="!!!"
          />
          <wrapper>
            <view>
              <text>
                <raw-text
                  text="Hello World"
                />
              </text>
            </view>
          </wrapper>
        </text>
      </view>
    `);

    b.removeChild(d);

    expect(a.__current_slot_index).toBe(2);
    expect(a.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <wrapper />
          <raw-text
            text="!!!"
          />
          <wrapper>
            <view>
              <text>
                <raw-text
                  text="Hello World"
                />
              </text>
            </view>
          </wrapper>
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
      `[TypeError: Cannot read properties of undefined (reading '$$uiSign')]`,
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
