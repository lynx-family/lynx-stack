// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import postcss from 'postcss';
import { describe, expect, test } from 'vitest';

describe('PostCSS - remove unsupported', () => {
  test('hello world', async () => {
    const { default: plugin } = await import('../src/index.js');

    const processor = postcss([plugin]);

    expect(processor.plugins).toHaveLength(1);

    const result = await processor.process(`.foo { color: red; }`, {
      from: 'foo.css',
    });
    expect(result.css).toMatchInlineSnapshot(`".foo { color: red; }"`);
  });
});
