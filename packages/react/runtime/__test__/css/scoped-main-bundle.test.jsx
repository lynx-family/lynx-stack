// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * @jsxCSSId 1000
 */

import { expect, it } from 'vitest';

import { SnapshotInstance } from '../../src/snapshot';

const snapshot1 = __SNAPSHOT__(
  <view>
    <text>Hello, World</text>
  </view>,
);

it('cssId', function() {
  const a = new SnapshotInstance(snapshot1);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view
      cssId="default-entry-from-native:1000"
    >
      <text
        cssId="default-entry-from-native:1000"
      >
        <raw-text
          cssId="default-entry-from-native:1000"
          text="Hello, World"
        />
      </text>
    </view>
  `);
});
