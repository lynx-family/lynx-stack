// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { describe, expect, rstest, test } from '@rstest/core';

import {
  createHtmlFragmentScriptRunScope,
  createHtmlFragmentToMainThreadScriptTool,
  getHtmlFragmentScriptMetadata,
  resolveHtmlFragmentScriptPlaceholders,
} from '../agent/lynx-xml/html-fragment-to-main-thread-script-tool.js';

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
  test('returns an opaque placeholder and id-to-node bindings', async () => {
    const xmlFragment =
      '\n  <view id="root"><text id="label">Hello &amp; 你好</text></view>\n';
    const { output, scope } = await executeFragmentTool(xmlFragment);
    expect(getHtmlFragmentScriptMetadata(scope)).toEqual({ xmlFragment });

    expect(output.placeholder).toMatch(
      /^\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\/$/u,
    );
    expect(output.bindings).toEqual({ root: 'node0', label: 'node1' });
    expect(Object.hasOwn(output, 'javascript')).toBe(false);
    expect(Object.hasOwn(output, 'xmlFragment')).toBe(false);

    const artifact = `<script thread="main">
function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${output.placeholder}
  __AddEventListener(node1, "tap", onTap, {});
}
</script>`;
    const resolved = resolveHtmlFragmentScriptPlaceholders(scope, artifact);
    expect(resolved).toContain('node0 = __CreateView(pageId);');
    expect(resolved).not.toContain('const node0');
    expect(resolved).toMatch(/^<script thread="main">\s*var node0, node1;/u);
    expect(resolved).toContain('__SetID(node1, "label");');
    expect(resolved).toContain(
      '__AddEventListener(node1, "tap", onTap, {});',
    );
    expect(resolved).not.toContain('__GENUI_HTML_FRAGMENT_');
  });

  test('isolates placeholders per run and rejects invalid placement', async () => {
    const first = await executeFragmentTool('<view id="first"/>');
    const second = await executeFragmentTool('<view id="second"/>');

    expect(getHtmlFragmentScriptMetadata(createHtmlFragmentScriptRunScope()))
      .toBeUndefined();
    expect(getHtmlFragmentScriptMetadata(first.scope)).toEqual({
      xmlFragment: '<view id="first"/>',
    });
    expect(getHtmlFragmentScriptMetadata(second.scope)).toEqual({
      xmlFragment: '<view id="second"/>',
    });
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

  test('lets external handlers access node13 after rendering and after a re-render', async () => {
    const xmlFragment = `<view>${
      Array.from({ length: 13 }, (_, index) =>
        `<text id="item${index}">示例数据</text>`).join('')
    }</view>`;
    const { output, scope } = await executeFragmentTool(xmlFragment);
    expect(output.bindings.item12).toBe('node13');
    const artifact = `<script thread="main">
"use strict";
function onRefreshTap() {
  __SetAttribute(node13, "text", "刚刚刷新");
}
function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${output.placeholder}
}
function updatePage() { onRefreshTap(); }
function destroyLifetime() { __SetAttribute(node13, "destroyed", true); }
renderPage();
onRefreshTap();
renderPage();
updatePage();
destroyLifetime();
</script>`;
    const resolved = resolveHtmlFragmentScriptPlaceholders(scope, artifact);
    const updates: { node: object; name: string; value: unknown }[] = [];
    const noop = rstest.fn();
    const script = resolved.slice(
      '<script thread="main">'.length,
      resolved.indexOf('</script>'),
    );
    expect(script.trimStart()).toMatch(/^"use strict";/u);
    expect(script.trimStart()).toMatch(/^"use strict";\s*var node0, node1, /u);
    runInNewContext(script, {
      __CreatePage: () => ({}),
      __GetElementUniqueID: () => 0,
      __CreateView: () => ({}),
      __CreateText: () => ({}),
      __CreateRawText: () => ({}),
      __SetID: noop,
      __AppendElement: noop,
      __SetAttribute: (node: object, name: string, value: unknown) => {
        updates.push({ node, name, value });
      },
    });
    expect(updates.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'text', value: '刚刚刷新' },
      { name: 'text', value: '刚刚刷新' },
      { name: 'destroyed', value: true },
    ]);
    expect(updates[0]?.node).not.toBe(updates[1]?.node);
    expect(updates[1]?.node).toBe(updates[2]?.node);
  });

  test.each([
    ['cityText', 'temperatureText', 'todayRange'],
    ['currentUnit', 'currentTemp', 'temp0'],
  ])(
    'resolves weather ids %s, %s, %s through render, tap, update and destroy',
    async (labelId, temperatureId, rangeId) => {
      const xmlFragment =
        `<view id="unitToggle"><text id="${labelId}">Shanghai</text><text id="${temperatureId}">26°</text><text id="${rangeId}">30° / 22°</text></view>`;
      const { output, scope } = await executeFragmentTool(xmlFragment);
      const artifact = `<script thread="main">
"use strict";
let fahrenheit = false;
function setText(node, value) {
  __ReplaceElements(node, [__CreateRawText(value)], __GetChildren(node));
}
function applyUnit() {
  setText(${labelId}, fahrenheit ? "Fahrenheit" : "Celsius");
  setText(${temperatureId}, fahrenheit ? "79°" : "26°");
  const ranges = [${rangeId}];
  setText(ranges[0], fahrenheit ? "86° / 72°" : "30° / 22°");
}
function onTap() { fahrenheit = !fahrenheit; applyUnit(); __FlushElementTree(); }
function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  ${output.placeholder}
  __AddEventListener(unitToggle, "tap", onTap, {});
  applyUnit();
}
function updatePage() { fahrenheit = false; applyUnit(); }
function destroyLifetime() { __RemoveEventListener(unitToggle, "tap", onTap, {}); }
renderPage();
</script>`;
      const resolved = resolveHtmlFragmentScriptPlaceholders(scope, artifact);
      interface Node {
        children: unknown[];
      }
      const nodes = new Map<string, Node>();
      const createNode = (): Node => ({ children: [] });
      const listeners = new Map<Node, () => void>();
      const flush = rstest.fn();
      const context = {
        __CreatePage: createNode,
        __CreateView: createNode,
        __CreateText: createNode,
        __CreateRawText: (text: string) => text,
        __GetElementUniqueID: () => 0,
        __SetID: (node: Node, id: string) => nodes.set(id, node),
        __AppendElement: (parent: Node, child: unknown) =>
          parent.children.push(child),
        __GetChildren: (node: Node) => node.children,
        __ReplaceElements: (node: Node, children: unknown[]) => {
          node.children = children;
        },
        __AddEventListener: (
          node: Node,
          _event: string,
          callback: () => void,
        ) => listeners.set(node, callback),
        __RemoveEventListener: (node: Node) => listeners.delete(node),
        __FlushElementTree: flush,
      };
      const script = resolved.slice(
        '<script thread="main">'.length,
        resolved.indexOf('</script>'),
      );
      runInNewContext(script, context);
      expect(nodes.get(temperatureId)?.children).toEqual(['26°']);
      listeners.get(nodes.get('unitToggle')!)!();
      expect(nodes.get(labelId)?.children).toEqual(['Fahrenheit']);
      expect(nodes.get(temperatureId)?.children).toEqual(['79°']);
      expect(nodes.get(rangeId)?.children).toEqual(['86° / 72°']);
      expect(flush).toHaveBeenCalledTimes(1);
      runInNewContext('updatePage(); destroyLifetime();', context);
      expect(nodes.get(temperatureId)?.children).toEqual(['26°']);
      expect(listeners.size).toBe(0);
      expect(getHtmlFragmentScriptMetadata(scope)).toEqual({ xmlFragment });
    },
  );

  test('exposes the converter as a Mastra tool', () => {
    expect(createHtmlFragmentToMainThreadScriptTool().id).toBe(
      'html_fragment_to_main_thread_script',
    );
  });
});
