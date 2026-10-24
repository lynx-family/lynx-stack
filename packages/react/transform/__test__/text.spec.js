// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const options = {
  mode: 'test',
  pluginName: '',
  filename: 'text.jsx',
  sourcemap: false,
  cssScope: false,
  snapshot: {
    preserveJsx: false,
    runtimePkg: '@lynx-js/react',
    jsxImportSource: '@lynx-js/react',
    filename: 'text',
    target: 'MIXED',
  },
  jsx: true,
  directiveDCE: false,
  defineDCE: false,
  shake: false,
  compat: false,
  worklet: false,
  refresh: false,
};

const input = [
  'const node = <view>',
  '  <text>{"  Hello\\n\\tWorld &amp;  "}</text>',
  '  <text>{`Hello ${getName()}`}</text>',
  '</view>;',
].join('\n');

describe('text expression optimization', () => {
  it.each([false, true])('sets text attributes with legacySlot=%s', async (legacySlot) => {
    const result = await transformReactLynx(input, {
      ...options,
      engineVersion: '3.1',
      snapshot: { ...options.snapshot, legacySlot },
    });

    expect(result.errors).toEqual([]);
    expect(result.code).toContain('__SetAttribute(el1, "text", "  Hello\\n\\tWorld &amp;  ")');
    expect(result.code).toContain('__SetAttribute(ctx.__elements[2], "text", ctx.__values[0])');
    expect(result.code).toContain('`Hello ${getName()}`');
    expect(result.code.match(/getName\(\)/g)).toHaveLength(1);
    expect(result.code).not.toContain('__CreateRawText');
    expect(result.code).not.toContain('__DynamicPart');
  });

  it.each([undefined, '3.0'])('keeps children with engineVersion=%s', async (engineVersion) => {
    const result = await transformReactLynx(input, { ...options, engineVersion });

    expect(result.errors).toEqual([]);
    expect(result.code).toContain('__DynamicPartSlotV2');
    expect(result.code).not.toContain('__SetAttribute');
  });

  it('keeps children when the JSX backend is disabled', async () => {
    const result = await transformReactLynx(input, {
      ...options,
      engineVersion: '3.1',
      snapshot: false,
    });

    expect(result.errors).toEqual([]);
    expect(result.code).toContain('<text>{"  Hello\\n\\tWorld &amp;  "}</text>');
    expect(result.code).toContain('<text>{`Hello ${getName()}`}</text>');
    expect(result.code).not.toContain('text=');
  });
});
