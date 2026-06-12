// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { extractPathFromIdentifier } from '../src/util.js';

describe('path', () => {
  test('extractPathFromIdentifier', () => {
    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!./src/baz.css',
      ),
    ).toBe('./src/baz.css');

    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css',
      ),
    ).toBe('./src/baz.css');

    // With ?cssId=
    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css?cssId=123',
      ),
    ).toBe('./src/baz.css');

    // With ?cssId=123&common
    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css?cssId=123&common',
      ),
    ).toBe('./src/baz.css');
    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css?cssId=123&common',
        true,
      ),
    ).toBe('./src/baz.css?cssId=123&common');

    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css?cssId=123&common???',
      ),
    ).toBe('./src/baz.css');
    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!./src/baz.css?cssId=123&common???',
        true,
      ),
    ).toBe('./src/baz.css?cssId=123&common???');

    expect(
      extractPathFromIdentifier(
        'css-loader/index.js??ruleSet[1].rules[1].use[1]!postcss-loader/index.js??ruleSet[1].rules[1].use[2]!/root/packages/src/baz.css',
      ),
    ).toBe('/root/packages/src/baz.css');
  });
});
