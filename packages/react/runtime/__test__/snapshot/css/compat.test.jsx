// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, it } from 'vitest';

import { createSnapshot, SnapshotInstance } from '../../../src/snapshot';

it('legacy createSnapshot', function() {
  const snapshot = createSnapshot(
    'test:css:compat:0',
    () => {
      const pageId = 0;
      const el = __CreateView(pageId);
      const el1 = __CreateText(pageId);
      __AppendElement(el, el1);
      const el2 = __CreateRawText('!!!');
      __AppendElement(el1, el2);
      const el3 = __CreateWrapperElement(pageId);
      __AppendElement(el, el3);
      return [
        el,
        el1,
        el2,
        el3,
      ];
    },
    null,
    null,
  );
  const a = new SnapshotInstance(snapshot);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view>
      <text>
        <raw-text
          text="!!!"
        />
      </text>
      <wrapper />
    </view>
  `);
});

it('legacy createSnapshot with cssId', function() {
  const snapshot = createSnapshot(
    'test:css:compat:1',
    () => {
      const pageId = 0;
      const el = __CreateView(pageId);
      const el1 = __CreateText(pageId);
      __AppendElement(el, el1);
      const el2 = __CreateRawText('!!!');
      __AppendElement(el1, el2);
      const el3 = __CreateWrapperElement(pageId);
      __AppendElement(el, el3);
      let e = [
        el,
        el1,
        el2,
        el3,
      ];
      __SetCSSId(e, 100);
      return e;
    },
    null,
    null,
  );
  const a = new SnapshotInstance(snapshot);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view
      cssId="default-entry-from-native:100"
    >
      <text
        cssId="default-entry-from-native:100"
      >
        <raw-text
          cssId="default-entry-from-native:100"
          text="!!!"
        />
      </text>
      <wrapper
        cssId="default-entry-from-native:100"
      />
    </view>
  `);
});

it('legacy createSnapshot with cssId and entryName', function() {
  const snapshot = createSnapshot(
    'test:css:compat:2',
    () => {
      const pageId = 0;
      const el = __CreateView(pageId);
      const el1 = __CreateText(pageId);
      __AppendElement(el, el1);
      const el2 = __CreateRawText('!!!');
      __AppendElement(el1, el2);
      const el3 = __CreateWrapperElement(pageId);
      __AppendElement(el, el3);
      let e = [
        el,
        el1,
        el2,
        el3,
      ];
      __SetCSSId(e, 999, 'BAR');
      return e;
    },
    null,
    null,
  );
  const a = new SnapshotInstance(snapshot);
  a.ensureElements();

  expect(a.__element_root).toMatchInlineSnapshot(`
    <view
      cssId="BAR:999"
    >
      <text
        cssId="BAR:999"
      >
        <raw-text
          cssId="BAR:999"
          text="!!!"
        />
      </text>
      <wrapper
        cssId="BAR:999"
      />
    </view>
  `);
});
