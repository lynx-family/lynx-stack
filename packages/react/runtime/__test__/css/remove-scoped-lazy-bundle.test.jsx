// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, it } from 'vitest';

import { SnapshotInstance } from '../../src/snapshot';

const prevEntryName = globalThis.globDynamicComponentEntry;
globalThis.globDynamicComponentEntry = 'FOO';
const snapshot1 = __SNAPSHOT__(
  <view>
    <text>Hello, World</text>
  </view>,
);
globalThis.globDynamicComponentEntry = prevEntryName;

it('no cssId with entry', function() {
  const a = new SnapshotInstance(snapshot1);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view
      cssId="FOO:0"
    >
      <text
        cssId="FOO:0"
      >
        <raw-text
          cssId="FOO:0"
          text="Hello, World"
        />
      </text>
    </view>
  `);
});
