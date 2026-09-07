// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  generateMainThreadScript,
  generateMainThreadScriptResult,
} from '../src/index.js';

describe('Lynx XML HTML fragment utilities', () => {
  test('generates ordered Element PAPI calls and id bindings', () => {
    const result = generateMainThreadScriptResult(`
      <scroll-view class="feed" id="root" style="height: 100vh;" scroll-orientation="vertical">
        <view class="card" data-kind="featured">
          <text id="greeting" aria-label="Greeting">Hello &amp; welcome</text>
          <image src="https://example.com/cover.png" />
        </view>
      </scroll-view>
    `);

    expect(result.bindings).toEqual({ root: 'node0', greeting: 'node2' });
    expect(result.javascript).toBe(`const node0 = __CreateScrollView(pageId);
__SetClasses(node0, "feed");
__SetID(node0, "root");
__SetInlineStyles(node0, "height: 100vh;");
__SetAttribute(node0, "scroll-orientation", "vertical");
const node1 = __CreateView(pageId);
__SetClasses(node1, "card");
__AddDataset(node1, "kind", "featured");
const node2 = __CreateText(pageId);
__SetID(node2, "greeting");
__SetAttribute(node2, "aria-label", "Greeting");
__AppendElement(node2, __CreateRawText("Hello & welcome"));
__AppendElement(node1, node2);
const node3 = __CreateImage(pageId);
__SetAttribute(node3, "src", "https://example.com/cover.png");
__AppendElement(node1, node3);
__AppendElement(node0, node1);
__AppendElement(page, node0);`);
  });

  test('supports multiple roots, text content, and generic element tags', () => {
    expect(
      generateMainThreadScript(
        '<view>Before<text>inside</text>after</view><input value="42" />',
      ),
    ).toBe(`const node0 = __CreateView(pageId);
const node1 = __CreateText(pageId);
__AppendElement(node1, __CreateRawText("Before"));
__AppendElement(node0, node1);
const node2 = __CreateText(pageId);
__AppendElement(node2, __CreateRawText("inside"));
__AppendElement(node0, node2);
const node3 = __CreateText(pageId);
__AppendElement(node3, __CreateRawText("after"));
__AppendElement(node0, node3);
__AppendElement(page, node0);
const node4 = __CreateElement("input", pageId);
__SetAttribute(node4, "value", "42");
__AppendElement(page, node4);`);
  });

  test('preserves meaningful text whitespace and ignores whitespace-only nodes', () => {
    const javascript = generateMainThreadScript(
      '<text>  spaced text  </text><view>   </view>',
    );

    expect(javascript).toContain('__CreateRawText("  spaced text  ")');
    expect(javascript).not.toContain('__CreateRawText("   ")');
  });

  test('escapes closing script sequences in generated JavaScript', () => {
    expect(generateMainThreadScript('<text>&lt;/script&gt;</text>')).toContain(
      '__CreateRawText("<\\/script>")',
    );
  });

  test('rejects empty, malformed, unsafe, and overly deep fragments', () => {
    expect(() => generateMainThreadScript('   ')).toThrow(
      'XML fragment must not be empty',
    );
    expect(() => generateMainThreadScript('<view><text></view>')).toThrow(
      'Invalid XML fragment',
    );
    expect(() => generateMainThreadScript('<script />')).toThrow(
      'Element <script> is not allowed',
    );
    expect(() =>
      generateMainThreadScript('<view id="duplicate"/><text id="duplicate"/>')
    ).toThrow('Duplicate XML id: duplicate');

    const overlyDeepFragment = `${'<view>'.repeat(65)}${'</view>'.repeat(65)}`;
    expect(() => generateMainThreadScript(overlyDeepFragment)).toThrow(
      'XML fragment must not exceed 64 levels of element nesting',
    );
  });
});
