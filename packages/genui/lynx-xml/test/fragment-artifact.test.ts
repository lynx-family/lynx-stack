// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { expect, rstest, test } from '@rstest/core';

import { compileLynxXmlFragment } from '../src/fragment-artifact.js';

function document(fragment: string, script = 'createFragment(page, pageId);') {
  return `<!doctype lynx>\n<lynx engine-version="4.2">\n<template>${fragment}</template>\n<style>.page { display: flex; flex-direction: column; }</style>\n<script thread="main">${script}</script>\n<script thread="background">const text = "background";</script>\n</lynx>`;
}

test('preserves fragment evidence and raw source blocks without serializing generated code through the model', () => {
  const fragment = '\n <view id="root"><text>Hello &amp; 你好</text></view>\n';
  const compiled = compileLynxXmlFragment(document(fragment));
  expect(compiled.xmlFragment).toBe(fragment);
  expect(compiled.text).not.toContain('<template>');
  expect(compiled.text).toContain('__CreateRawText("Hello & 你好")');
  expect(compiled.text).toContain(
    '<style>.page { display: flex; flex-direction: column; }</style>',
  );
  expect(compiled.text).toContain(
    '<script thread="background">const text = "background";</script>',
  );
  expect(compiled.text).toContain('nodeMap["root"] = element;');
  expect(compiled.text).not.toMatch(/\bnode\d+\b/u);
  expect(compileLynxXmlFragment(document(fragment))).toEqual(compiled);
});

test('id references work for initial state, taps, updates, rerender and cleanup', () => {
  const fragment =
    '<view id="refresh"><text id="temp">18°</text><text id="__proto__">Safe</text></view>';
  const script = `"use strict"
let nodes;
let temperature = 18;
const node0 = "model-local";
function updatePage() { __ReplaceElements(nodes.temp, [__CreateRawText(String(temperature))], __GetChildren(nodes.temp)); }
function onTap() { temperature++; updatePage(); __FlushElementTree(); }
function renderPage() {
  const page = __CreatePage("0", 0);
  const pageId = __GetElementUniqueID(page);
  nodes = createFragment(page, pageId);
  __AddEventListener(nodes.refresh, "tap", onTap, {});
  updatePage();
}
function cleanup() { __RemoveEventListener(nodes.refresh, "tap", onTap, {}); }
renderPage();`;
  const compiled = compileLynxXmlFragment(document(fragment, script));
  interface Node {
    children: unknown[];
  }
  const byId = new Map<string, Node>();
  const listeners = new Map<Node, () => void>();
  const create = (): Node => ({ children: [] });
  const flush = rstest.fn();
  const context = {
    __CreatePage: create,
    __CreateView: create,
    __CreateText: create,
    __CreateRawText: (text: string) => text,
    __GetElementUniqueID: () => 0,
    __SetID: (node: Node, id: string) => byId.set(id, node),
    __AppendElement: (parent: Node, child: unknown) =>
      parent.children.push(child),
    __GetChildren: (node: Node) => node.children,
    __ReplaceElements: (node: Node, children: unknown[]) => {
      node.children = children;
    },
    __AddEventListener: (node: Node, _name: string, callback: () => void) =>
      listeners.set(node, callback),
    __RemoveEventListener: (node: Node) => listeners.delete(node),
    __FlushElementTree: flush,
  };
  const main = compiled.text.split('<script thread="main">')[1]!.split(
    '</script>',
  )[0]!;
  expect(main.startsWith('"use strict"\n')).toBe(true);
  runInNewContext(main, context);
  expect(byId.get('temp')?.children).toEqual(['18']);
  const first = byId.get('temp');
  listeners.get(byId.get('refresh')!)!();
  expect(first?.children).toEqual(['19']);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(runInNewContext('nodes.__proto__', context)).toBe(
    byId.get('__proto__'),
  );
  expect(runInNewContext('node0', context)).toBe('model-local');
  runInNewContext('cleanup(); renderPage(); updatePage(); cleanup();', context);
  expect(byId.get('temp')).not.toBe(first);
  expect(byId.get('temp')?.children).toEqual(['19']);
  expect(listeners.size).toBe(0);
});

test.each(['before-style', 'after-style', 'after-script'])(
  'compiles a root template %s and preserves literal template text in scripts',
  position => {
    const fragment =
      '\n<view><text>Static without id</text><text id="temp1">26°</text></view>\n';
    const template = `<template>${fragment}</template>`;
    const style =
      '<style>.page { display: flex; flex-direction: column; }</style>';
    const script =
      '<script thread="main">const example = "<template>literal</template>"; createFragment(page, pageId);</script>';
    let blocks = [template, style, script];
    if (position === 'after-style') blocks = [style, template, script];
    else if (position === 'after-script') blocks = [style, script, template];
    const source =
      '<!doctype lynx>\n<lynx engine-version="4.2">\n<!-- page content -->\n'
      + blocks.join('\n<!-- next block -->\n') + '\n</lynx>';
    const compiled = compileLynxXmlFragment(source);
    expect(compiled.xmlFragment).toBe(fragment);
    expect(compiled.text).toContain(style);
    expect(compiled.text).toContain('"<template>literal</template>"');
    expect(compiled.text).not.toContain(template);
    expect(compiled.text).toContain('nodeMap["temp1"] = element;');
    expect(compiled.text.match(/__SetID\(/gu)).toHaveLength(1);
  },
);

test('accepts a wholly static fragment without any ids', () => {
  const compiled = compileLynxXmlFragment(
    document('<view><text>Static</text></view>'),
  );
  expect(compiled.text).toContain('return nodeMap;');
  expect(compiled.text).not.toContain('nodeMap[');
  expect(compiled.text).not.toContain('__SetID');
});

test('does not treat template text inside a script as a root fragment', () => {
  const source = document(
    '<view/>',
    'const example = "<template><view/></template>"; createFragment(page, pageId);',
  )
    .replace('<template><view/></template>', '');
  expect(() => compileLynxXmlFragment(source)).toThrow(
    'model omitted the XML fragment',
  );
});

test.each([
  [document('<script>bad</script>'), 'not allowed'],
  [document('<view><text></view>'), 'Invalid XML'],
  [document('<view id="a"/><view id="a"/>'), 'Duplicate XML id'],
  [document('<view/>', ''), 'must call createFragment'],
  [
    document(
      '<view/>',
      'createFragment(page, pageId); createFragment(page, pageId);',
    ),
    'exactly once',
  ],
  [document('<view/>', 'createFragment(page);'), 'two arguments'],
  [
    document(
      '<view/>',
      'function createFragment() {} createFragment(page, pageId);',
    ),
    'must not be declared',
  ],
  [
    document(
      '<view/>',
      'function render(createFragment) { createFragment(page, pageId); }',
    ),
    'must not be declared',
  ],
  [
    document('<view/>').replace(
      '<style>',
      '<template><view/></template><style>',
    ),
    'exactly one <template>',
  ],
  [
    document('<view/>').replace('</lynx>', ''),
    'complete template/style/script blocks',
  ],
  [
    document('<view/>').replace('<template><view/></template>', ''),
    'model omitted the XML fragment',
  ],
])('rejects malformed intermediate source: %s', (source, message) => {
  expect(() => compileLynxXmlFragment(source)).toThrow(message);
});
