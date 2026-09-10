// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { describe, expect, test } from '@rstest/core';

import {
  generateMainThreadScript,
  generateMainThreadScriptResult,
} from '../src/index.js';

describe('Lynx XML HTML fragment utilities', () => {
  test('creates the ordered tree and retains only explicit ids without per-node variables', () => {
    const result = generateMainThreadScriptResult(`
      <scroll-view class="feed" id="root" style="height: 100vh;" scroll-orientation="vertical">
        <view class="card" data-kind="featured">
          <text id="greeting" accessibility-label="Greeting">Hello &amp; welcome</text>
          <image src="https://example.com/cover.png" />
        </view>
      </scroll-view>
      <input value="42" />
    `);
    interface Node {
      tag: string;
      children: Node[];
      values: Record<string, string>;
    }
    const create = (tag: string): Node => ({ tag, children: [], values: {} });
    const page = create('page');
    const context = {
      page,
      pageId: 0,
      __CreateScrollView: () => create('scroll-view'),
      __CreateView: () => create('view'),
      __CreateText: () => create('text'),
      __CreateImage: () => create('image'),
      __CreateElement: create,
      __CreateRawText: (value: string) => ({
        ...create('raw-text'),
        values: { text: value },
      }),
      __AppendElement: (parent: Node, child: Node) =>
        parent.children.push(child),
      __SetID: (node: Node, value: string) => {
        node.values['id'] = value;
      },
      __SetClasses: (node: Node, value: string) => {
        node.values['class'] = value;
      },
      __SetInlineStyles: (node: Node, value: string) => {
        node.values['style'] = value;
      },
      __SetAttribute: (node: Node, name: string, value: string) => {
        node.values[name] = value;
      },
      __AddDataset: (node: Node, name: string, value: string) => {
        node.values[`data-${name}`] = value;
      },
    };
    const map = runInNewContext(
      result.javascript + '\nnodeMap;',
      context,
    ) as Record<string, Node>;
    expect(Object.keys(map)).toEqual(['root', 'greeting']);
    expect(result.bindings).toEqual({
      root: 'nodeMap["root"]',
      greeting: 'nodeMap["greeting"]',
    });
    expect(result.javascript).not.toMatch(/\bnode\d+\b/u);
    expect(result.javascript.match(/let element;/gu)).toHaveLength(1);
    expect(page.children.map(node => node.tag)).toEqual([
      'scroll-view',
      'input',
    ]);
    expect(map['root']).toBe(page.children[0]);
    expect(map['root']?.values).toEqual({
      class: 'feed',
      id: 'root',
      style: 'height: 100vh;',
      'scroll-orientation': 'vertical',
    });
    const card = map['root']!.children[0]!;
    expect(card.values).toEqual({ class: 'card', 'data-kind': 'featured' });
    expect(card.children.map(node => node.tag)).toEqual(['text', 'image']);
    expect(map['greeting']).toBe(card.children[0]);
    expect(map['greeting']?.children[0]?.values['text']).toBe(
      'Hello & welcome',
    );
    expect(card.children[1]?.values['src']).toBe(
      'https://example.com/cover.png',
    );
    expect(page.children[1]?.values['value']).toBe('42');
  });

  test('wraps text outside text elements and leaves purely static nodes out of the map', () => {
    const javascript = generateMainThreadScript(
      '<view>Before<text>inside</text>after</view>',
    );
    expect(javascript).not.toContain('nodeMap[');
    expect(javascript).not.toMatch(/\bnode\d+\b/u);
    expect(javascript.match(/__CreateText\(pageId\)/gu)).toHaveLength(3);
    expect(javascript).toContain('__CreateRawText("Before")');
    expect(javascript).toContain('__CreateRawText("inside")');
    expect(javascript).toContain('__CreateRawText("after")');
  });

  test('creates real raw-text leaves from content and text attributes in source order', () => {
    const result = generateMainThreadScriptResult(
      '<text id="label">Before<raw-text id="value" text="26° &amp; 晴"/><raw-text> </raw-text><raw-text>&lt;/script&gt;</raw-text>After</text>',
    );
    interface Node {
      children: unknown[];
    }
    const page: Node = { children: [] };
    const nodes: Record<string, unknown> = {};
    runInNewContext(result.javascript, {
      page,
      pageId: 0,
      __CreateText: (): Node => ({ children: [] }),
      __CreateRawText: (text: string) => ({ text }),
      __SetID: (node: unknown, id: string) => {
        nodes[id] = node;
      },
      __AppendElement: (parent: Node, child: unknown) =>
        parent.children.push(child),
    });
    expect((page.children[0] as Node).children).toEqual([
      { text: 'Before' },
      { text: '26° & 晴' },
      { text: ' ' },
      { text: '</script>' },
      { text: 'After' },
    ]);
    expect(nodes['label']).toBe(page.children[0]);
    expect(nodes['value']).toBe((page.children[0] as Node).children[1]);
    expect(Object.keys(result.bindings)).toEqual(['label', 'value']);
    expect(result.javascript).not.toContain('__CreateElement("raw-text"');
    expect(result.javascript).toContain('__CreateRawText("<\\/script>")');
  });

  test('wraps a standalone raw-text leaf in a text element', () => {
    interface Node {
      children: unknown[];
    }
    const page: Node = { children: [] };
    runInNewContext(
      generateMainThreadScript(
        '<view><raw-text text="Hello"/></view><raw-text>World</raw-text>',
      ),
      {
        page,
        pageId: 0,
        __CreateView: (): Node => ({ children: [] }),
        __CreateText: (): Node => ({ children: [] }),
        __CreateRawText: (text: string) => text,
        __AppendElement: (parent: Node, child: unknown) =>
          parent.children.push(child),
      },
    );
    expect(page.children).toEqual([
      { children: [{ children: ['Hello'] }] },
      { children: ['World'] },
    ]);
  });

  test.each([
    ['<text><raw-text><view/></raw-text></text>', 'only literal text'],
    ['<text><raw-text text="A">B</raw-text></text>', 'not both'],
    [
      '<text><raw-text class="title">A</raw-text></text>',
      'parent text element',
    ],
  ])('rejects invalid raw-text: %s', (fragment, message) => {
    expect(() => generateMainThreadScript(fragment)).toThrow(message);
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
