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
          : `ctx.nodes.count = ctx.createText("0"); ctx.append(ctx.page, ctx.nodes.count);`
      }
    const dynamic = ctx.createView();
    const scroll = ctx.createScrollView();
    const label = ctx.createText("ready");
    const image = ctx.createImage();
    const retained = ctx.createView();
    const removed = ctx.createText("removed");
    ctx.on(retained, "retained", onRetained);
    ctx.on(removed, "removed", onRemoved);
    ctx.setClasses(dynamic, "dynamic");
    ctx.setAttribute(image, "src", "asset");
    ctx.setInlineStyles(image, "opacity: 1;");
    ctx.replaceChildren(dynamic, [retained, removed]);
    ctx.replaceChildren(dynamic, [retained, label, image]);
    ctx.append(scroll, dynamic);
    ctx.append(ctx.page, scroll);
    count = data.count || 0;
    ctx.setText(ctx.nodes.count, count);
    ctx.on(ctx.nodes.count, "tap", () => { ctx.setText(ctx.nodes.count, ++count); });
    ctx.listen("patch", event => ctx.setText(ctx.nodes.count, event.data));
    ctx.listen(bridge, "legacy", event => ctx.setText(ctx.nodes.count, event.data));
    ctx.emit("request", { count });
    ctx.flush();
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
    const eventOptions = new Map<string, unknown>();
    const appEvents = new Map<string, (event?: unknown) => void>();
    interface Node {
      children: unknown[];
    }
    const texts: Node[] = [];
    const create = (): Node => ({ children: [] });
    const flush = rstest.fn();
    const onDestroy = rstest.fn();
    const onRetained = rstest.fn();
    const onRemoved = rstest.fn();
    const createPage = rstest.fn(create);
    const views: Node[] = [];
    const scrollViews: Node[] = [];
    const images: Node[] = [];
    const createView = rstest.fn(() => {
      const node = create();
      views.push(node);
      return node;
    });
    const createScrollView = rstest.fn(() => {
      const node = create();
      scrollViews.push(node);
      return node;
    });
    const createImage = rstest.fn(() => {
      const node = create();
      images.push(node);
      return node;
    });
    const setClasses = rstest.fn();
    const setAttribute = rstest.fn();
    const setInlineStyles = rstest.fn();
    const dispatchedEvents: unknown[] = [];
    const bridge = {
      addEventListener: (name: string, handler: () => void) =>
        appEvents.set(name, handler),
      removeEventListener: (name: string, handler: () => void) => {
        expect(appEvents.get(name)).toBe(handler);
        appEvents.delete(name);
      },
      dispatchEvent: (event: unknown) => dispatchedEvents.push(event),
    };
    const getCoreContext = rstest.fn(() => bridge);
    const context = {
      bridge,
      lynx: {
        getEngine: () => ({
          addEventListener: (name: string, handler: () => void) =>
            lifecycle.set(name, handler),
          removeEventListener: (name: string, handler: () => void) => {
            expect(lifecycle.get(name)).toBe(handler);
            lifecycle.delete(name);
          },
        }),
        getCoreContext,
      },
      __CreatePage: createPage,
      __CreateView: createView,
      __CreateScrollView: createScrollView,
      __CreateText: () => {
        const node = create();
        texts.push(node);
        return node;
      },
      __CreateImage: createImage,
      __CreateRawText: (text: string) => text,
      __GetElementUniqueID: () => 42,
      __SetID: rstest.fn(),
      __SetClasses: setClasses,
      __SetAttribute: setAttribute,
      __SetInlineStyles: setInlineStyles,
      __AppendElement: (parent: Node, child: unknown) =>
        parent.children.push(child),
      __GetChildren: (node: Node) => node.children,
      __ElementIsEqual: (left: unknown, right: unknown) => left === right,
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
        eventOptions.set(name, options);
      },
      __RemoveEventListener: (
        _node: Node,
        name: string,
        handler: () => void,
        options: unknown,
      ) => {
        expect(events.get(name)).toBe(handler);
        expect(options).toBe(eventOptions.get(name));
        events.delete(name);
        eventOptions.delete(name);
      },
      __FlushElementTree: flush,
      onDestroy,
      onRetained,
      onRemoved,
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
    expect(createView).toHaveBeenCalledWith(42);
    expect(createScrollView).toHaveBeenCalledWith(42);
    expect(createImage).toHaveBeenCalledWith(42);
    expect(setClasses).toHaveBeenCalledWith(views[0], 'dynamic');
    expect(setAttribute).toHaveBeenCalledWith(images[0], 'src', 'asset');
    expect(setInlineStyles).toHaveBeenCalledWith(images[0], 'opacity: 1;');
    expect(views[0]?.children).toEqual([views[1], texts[1], images[0]]);
    expect(scrollViews[0]?.children).toEqual([views[0]]);
    expect(texts[0]?.children).toEqual(['4']);
    expect(events.has('retained')).toBe(true);
    expect(events.has('removed')).toBe(false);
    expect(dispatchedEvents).toEqual([{ type: 'request', data: { count: 4 } }]);
    expect(getCoreContext).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    events.get('retained')!();
    expect(onRetained).toHaveBeenCalledTimes(1);
    const tap = events.get('tap')!;
    tap();
    expect(texts[0]?.children).toEqual(['5']);
    update({ data: [{ count: 8 }] });
    expect(texts[0]?.children).toEqual(['8']);
    update({ data: null });
    expect(texts[0]?.children).toEqual(['0']);
    appEvents.get('patch')!({ data: 12 });
    expect(texts[0]?.children).toEqual(['12']);
    expect(flush).toHaveBeenCalledTimes(6);
    destroy();
    destroy();
    tap();
    render();
    update();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(events.size + appEvents.size + lifecycle.size).toBe(0);
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(6);
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
