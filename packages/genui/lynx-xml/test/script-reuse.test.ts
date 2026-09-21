// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { expect, rstest, test } from '@rstest/core';

import { assembleLynxXmlArtifact } from '../src/fragment-artifact.js';
import { buildLynxXmlSystemPrompt } from '../src/prompt.js';

function document(script: string, template = true) {
  return `<!doctype lynx>
<lynx engine-version="4.2">
${template ? '<template><text id="count" class="p-4">0</text></template>' : ''}
<script thread="main">${script}</script>
</lynx>`;
}

test.each([false, true])(
  'shared script renders, updates, unsubscribes and destroys (template=%s)',
  template => {
    const source = document(
      `"use strict";
let count = 0;
definePage({
  render(ctx, data) {
    ${
        template
          ? ''
          : `ctx.nodes.count = __CreateText(ctx.pageId); __AppendElement(ctx.page, ctx.nodes.count);`
      }
    count = data.count || 0;
    ctx.setText(ctx.nodes.count, count);
    ctx.on(ctx.nodes.count, "tap", () => { ctx.setText(ctx.nodes.count, ++count); });
    ctx.listen(bridge, "patch", event => ctx.setText(ctx.nodes.count, event.data));
  },
  update(ctx, patch) { ctx.setText(ctx.nodes.count, patch.count || 0); },
  destroy() { onDestroy(); }
});`,
      template,
    );
    const compiled = assembleLynxXmlArtifact(source, {
      enableScriptReuse: true,
      enableHtmlFragment: template,
      stylePreset: 'default',
    });
    expect(compiled.text).not.toContain('<template>');
    expect(compiled.text.match(/<style>/gu)).toHaveLength(1);
    expect(compiled.text).toContain(
      '.genui-page { display: flex; flex-direction: column; }',
    );
    expect(compiled.text.length).toBeGreaterThan(source.length);
    const lifecycle = new Map<string, (event?: unknown) => void>();
    const events = new Map<string, (event?: unknown) => void>();
    const appEvents = new Map<string, (event?: unknown) => void>();
    const registeredOptions: unknown[] = [];
    interface Node {
      children: unknown[];
    }
    const texts: Node[] = [];
    const create = (): Node => ({ children: [] });
    const flush = rstest.fn();
    const onDestroy = rstest.fn();
    const createPage = rstest.fn(create);
    const context = {
      lynx: {
        getEngine: () => ({
          addEventListener: (name: string, handler: () => void) =>
            lifecycle.set(name, handler),
          removeEventListener: (name: string, handler: () => void) => {
            expect(lifecycle.get(name)).toBe(handler);
            lifecycle.delete(name);
          },
        }),
      },
      bridge: {
        addEventListener: (name: string, handler: () => void) =>
          appEvents.set(name, handler),
        removeEventListener: (name: string, handler: () => void) => {
          expect(appEvents.get(name)).toBe(handler);
          appEvents.delete(name);
        },
      },
      __CreatePage: createPage,
      __CreateText: () => {
        const node = create();
        texts.push(node);
        return node;
      },
      __CreateRawText: (text: string) => text,
      __GetElementUniqueID: () => 42,
      __SetID: rstest.fn(),
      __SetClasses: rstest.fn(),
      __AppendElement: (parent: Node, child: unknown) =>
        parent.children.push(child),
      __GetChildren: (node: Node) => node.children,
      __ReplaceElements: (node: Node, children: unknown[]) => {
        node.children = children;
      },
      __AddEventListener: (
        _node: Node,
        name: string,
        handler: () => void,
        options: unknown,
      ) => {
        events.set(name, handler);
        registeredOptions.push(options);
      },
      __RemoveEventListener: (
        _node: Node,
        name: string,
        handler: () => void,
        options: unknown,
      ) => {
        expect(events.get(name)).toBe(handler);
        expect(options).toBe(registeredOptions[0]);
        events.delete(name);
      },
      __FlushElementTree: flush,
      onDestroy,
    };
    const main = compiled.text.split('<script thread="main">')[1]!.split(
      '</script>',
    )[0]!;
    expect(main.startsWith('"use strict";')).toBe(true);
    runInNewContext(main, context);
    const render = lifecycle.get('__RenderPage')!;
    const update = lifecycle.get('__UpdatePage')!;
    const destroy = lifecycle.get('__DestroyLifetime')!;
    update({ data: [{ count: 99 }] });
    expect(createPage).not.toHaveBeenCalled();
    render({ data: [{ count: 4 }] });
    render();
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(texts[0]?.children).toEqual(['4']);
    expect(flush).not.toHaveBeenCalled();
    const tap = events.get('tap')!;
    tap();
    expect(texts[0]?.children).toEqual(['5']);
    update({ data: [{ count: 8 }] });
    expect(texts[0]?.children).toEqual(['8']);
    update({ data: null });
    expect(texts[0]?.children).toEqual(['0']);
    appEvents.get('patch')!({ data: 12 });
    expect(texts[0]?.children).toEqual(['12']);
    expect(flush).toHaveBeenCalledTimes(4);
    destroy();
    destroy();
    tap();
    render();
    update();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(events.size + appEvents.size + lifecycle.size).toBe(0);
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(4);
  },
);

test.each([
  '',
  'function definePage() {} definePage({});',
  'definePage({}); definePage({});',
  'definePage({render: 3});',
  'definePage({async render() {}});',
  'definePage({render() {}, render() {}});',
  'definePage({mount() {}});',
  'definePage({render() { createFragment(page, pageId); }});',
  'definePage({render() { __CreatePage("0", 0); }});',
  'definePage({}); lynx.getEngine();',
  'const x = "<template>fake</template>";',
])('rejects invalid reuse contract without executing source: %s', script => {
  expect(() =>
    assembleLynxXmlArtifact(document(script), {
      enableHtmlFragment: true,
      enableScriptReuse: true,
    })
  ).toThrow();
});

test('off leaves direct scripts untouched and on needs a render hook without Template', () => {
  const source = document('const untouched = true;', false);
  expect(assembleLynxXmlArtifact(source).text).toBe(source);
  expect(() =>
    assembleLynxXmlArtifact(document('definePage({});', false), {
      enableScriptReuse: true,
    })
  ).toThrow('requires a render hook');
});

test('reused script prompts omit implementation and redundant lifecycle instructions', () => {
  for (const enableHtmlFragment of [false, true]) {
    const plain = buildLynxXmlSystemPrompt({ enableHtmlFragment });
    const reused = buildLynxXmlSystemPrompt({
      enableHtmlFragment,
      enableScriptReuse: true,
    });
    expect(reused).toContain('ScriptReuse is enabled');
    expect(reused).not.toContain('function definePage');
    expect(reused).not.toContain('nodes = createFragment(page, pageId)');
    expect(plain).not.toContain('ScriptReuse is enabled');
    // Character counts are evidence of prompt size, not provider token estimates.
    expect(reused.length).toBeLessThan(plain.length);
  }
});
