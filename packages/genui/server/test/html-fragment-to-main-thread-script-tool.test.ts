// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  createHtmlFragmentScriptRunScope,
  createHtmlFragmentToMainThreadScriptTool,
  generateMainThreadScript,
  resolveHtmlFragmentScriptPlaceholders,
} from '../agent/html-fragment-to-main-thread-script-tool.js';

interface FragmentToolOutput {
  bindings: Record<string, string>;
  placeholder: string;
}

async function executeFragmentTool(
  xmlFragment: string,
  scope = createHtmlFragmentScriptRunScope(),
): Promise<{ output: FragmentToolOutput; scope: typeof scope }> {
  const tool = createHtmlFragmentToMainThreadScriptTool();
  if (!tool.execute) throw new Error('fragment tool execute is missing');
  const output = await tool.execute(
    { xmlFragment },
    { requestContext: scope.requestContext } as never,
  );
  return { output: output as FragmentToolOutput, scope };
}

describe('HTML fragment to main-thread script tool', () => {
  test('generates ordered Element PAPI calls for nested Lynx elements', () => {
    const javascript = generateMainThreadScript(`
      <scroll-view class="feed" id="root" style="height: 100vh;" scroll-orientation="vertical">
        <view class="card" data-kind="featured">
          <text aria-label="Greeting">Hello &amp; welcome</text>
          <image src="https://example.com/cover.png" />
        </view>
      </scroll-view>
    `);

    expect(javascript).toBe(`const node0 = __CreateScrollView(pageId);
__SetClasses(node0, "feed");
__SetID(node0, "root");
__SetInlineStyles(node0, "height: 100vh;");
__SetAttribute(node0, "scroll-orientation", "vertical");
const node1 = __CreateView(pageId);
__SetClasses(node1, "card");
__AddDataset(node1, "kind", "featured");
const node2 = __CreateText(pageId);
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

  test('rejects empty and malformed XML fragments', () => {
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

  test('returns an opaque placeholder and id-to-node bindings', async () => {
    const { output, scope } = await executeFragmentTool(
      '<view id="root"><text id="label">Hello</text></view>',
    );

    expect(output.placeholder).toMatch(
      /^\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\/$/u,
    );
    expect(output.bindings).toEqual({ root: 'node0', label: 'node1' });
    expect(Object.hasOwn(output, 'javascript')).toBe(false);

    const artifact = `function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${output.placeholder}
  __AddEventListener(node1, "tap", onTap, {});
}`;
    const resolved = resolveHtmlFragmentScriptPlaceholders(scope, artifact);
    expect(resolved).toContain('const node0 = __CreateView(pageId);');
    expect(resolved).toContain('__SetID(node1, "label");');
    expect(resolved).toContain(
      '__AddEventListener(node1, "tap", onTap, {});',
    );
    expect(resolved).not.toContain('__GENUI_HTML_FRAGMENT_');
  });

  test('isolates placeholders per run and rejects invalid placement', async () => {
    const first = await executeFragmentTool('<view id="first"/>');
    const second = await executeFragmentTool('<view id="second"/>');

    expect(first.output.placeholder).not.toBe(second.output.placeholder);
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        second.output.placeholder,
      )
    ).toThrow('unknown fragment placeholder');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(first.scope, 'no placeholder')
    ).toThrow('must appear exactly once');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        `${first.output.placeholder}\n${first.output.placeholder}`,
      )
    ).toThrow('must appear exactly once');
    expect(() =>
      resolveHtmlFragmentScriptPlaceholders(
        first.scope,
        `const marker = ${JSON.stringify(first.output.placeholder)};`,
      )
    ).toThrow('must appear on its own line');

    const tool = createHtmlFragmentToMainThreadScriptTool();
    if (!tool.execute) throw new Error('fragment tool execute is missing');
    await expect(tool.execute(
      { xmlFragment: '<view/>' },
      { requestContext: first.scope.requestContext } as never,
    )).rejects.toThrow('may only be called once per agent run');
  });

  test('exposes the converter as a Mastra tool', () => {
    expect(createHtmlFragmentToMainThreadScriptTool().id).toBe(
      'html_fragment_to_main_thread_script',
    );
  });
});
