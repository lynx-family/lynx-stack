// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * @jsxCSSId 1000
 */

import { expect, it, beforeEach, afterEach } from 'vitest';

import { SnapshotInstance } from '../../src/snapshot';

let prevEntryName;
beforeEach(() => {
  prevEntryName = globalThis.globDynamicComponentEntry;
  globalThis.globDynamicComponentEntry = 'FOO';
});
afterEach(() => {
  globalThis.globDynamicComponentEntry = prevEntryName;
});

const snapshot1 = __SNAPSHOT__(
  <view>
    <text>Hello, World</text>
  </view>,
);

it('cssId with entry', function() {
  const a = new SnapshotInstance(snapshot1);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view
      cssId="FOO:1000"
    >
      <text
        cssId="FOO:1000"
      >
        <raw-text
          cssId="FOO:1000"
          text="Hello, World"
        />
      </text>
    </view>
  `);
});
