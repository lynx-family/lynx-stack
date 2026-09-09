// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { formatXmlFragment } from './format-xml-fragment.js';

test('formats multiple roots while preserving entities and mixed text', () => {
  expect(
    formatXmlFragment(
      '<view><text>A &amp; B</text></view><text>Hello <text>world</text>!</text>',
    ),
  ).toBe(
    '<view>\n  <text>A &amp; B</text>\n</view>\n<text>Hello <text>world</text>!</text>',
  );
});

test('leaves malformed fragments available only as raw source', () => {
  expect(formatXmlFragment('<view><text>incomplete')).toBeUndefined();
});
