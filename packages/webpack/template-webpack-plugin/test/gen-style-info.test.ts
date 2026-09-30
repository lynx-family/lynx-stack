// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import * as CSS from '@lynx-js/css-serializer';

import { genStyleInfo } from '../src/web/genStyleInfo.js';

function gen(css: string) {
  return genStyleInfo({ '0': CSS.parse(css).root })['0']!;
}

describe('genStyleInfo', () => {
  test('keeps @media groups, in order and nested', () => {
    const info = gen(
      '.a{width:1px}'
        + '@media (min-width: 400px){'
        + '.a{width:2px}'
        + '@media (prefers-color-scheme: dark){view{width:3px}}'
        + '}'
        + '.b{width:4px}',
    );

    expect(info.rules).toStrictEqual([
      { sel: [[['.a'], [], [], []]], decl: [['width', '1px']] },
      {
        media: '(min-width:400px)',
        rules: [
          { sel: [[['.a'], [], [], []]], decl: [['width', '2px']] },
          {
            media: '(prefers-color-scheme:dark)',
            rules: [
              {
                sel: [[['[lynx-tag="view"]'], [], [], []]],
                decl: [['width', '3px']],
              },
            ],
          },
        ],
      },
      { sel: [[['.b'], [], [], []]], decl: [['width', '4px']] },
    ]);
    expect(info.content).toStrictEqual(['']);
  });

  test('drops @supports and @layer', () => {
    const info = gen(
      '@supports (display:grid){.a{width:1px}}@layer base{.b{width:2px}}',
    );
    expect(info.rules).toStrictEqual([]);
  });
});
