// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { describe, expect, rstest, test } from '@rstest/core';

import {
  LYNX_XML_DEMOS_LIST_SOURCE,
  LYNX_XML_DEMOS_PAGE_SOURCE,
  LYNX_XML_SCENARIOS,
} from './lynx-xml.js';
import { PROTOCOLS } from '../../utils/protocol.js';

const FLEX_LAYOUT_CLASSES: Readonly<Record<string, readonly string[]>> = {
  'script-reuse-counter': ['genui-page', 'flex'],
  'style-preset-counter': ['flex'],
  'template-counter': [
    'counter-card',
    'value-panel',
    'stats',
    'stat',
    'stepper',
    'step-button',
    'reset-button',
  ],
  counter: [
    'counter-card',
    'value-panel',
    'stepper',
    'step-button',
    'reset-button',
  ],
  'travel-plan': [
    'scroll',
    'content',
    'hero',
    'hero-stats',
    'hero-stat',
    'day-tabs',
    'day-tab',
    'route-host',
    'route-card',
    'route-header',
    'stop',
    'stop-copy',
  ],
  'product-card': [
    'product-card',
    'visual',
    'content',
    'meta-row',
    'swatches',
    'swatch',
    'purchase-row',
    'price-block',
    'quantity',
    'quantity-button',
    'add-button',
  ],
  'weather-card': [
    'weather-card',
    'hero',
    'top-row',
    'location-block',
    'condition-icon',
    'temperature-row',
    'condition-copy',
    'city-tabs',
    'city-tab',
    'details',
    'metrics',
    'metric',
    'bar-track',
    'refresh-button',
  ],
  'todo-list': [
    'scroll',
    'content',
    'header',
    'add-button',
    'filter-row',
    'filter-button',
    'list',
    'todo-row',
    'checkbox',
    'todo-copy',
    'footer',
    'clear-button',
  ],
};

const ROW_LAYOUT_CLASSES: Readonly<Record<string, readonly string[]>> = {
  'script-reuse-counter': ['flex-row'],
  'style-preset-counter': ['flex-row'],
  'template-counter': ['stats', 'stepper'],
  counter: ['stepper'],
  'travel-plan': ['hero-stats', 'day-tabs', 'route-header', 'stop'],
  'product-card': ['meta-row', 'swatches', 'purchase-row', 'quantity'],
  'weather-card': [
    'top-row',
    'temperature-row',
    'city-tabs',
    'metrics',
    'bar-track',
  ],
  'todo-list': ['filter-row', 'todo-row', 'footer'],
};

function expectCssDeclaration(
  source: string,
  className: string,
  declaration: string,
): void {
  expect(source).toMatch(
    new RegExp(
      `\\.${className}\\s*\\{[^}]*${declaration.replaceAll(' ', '\\s*')}`,
      'u',
    ),
  );
}

describe('Lynx XML showcase', () => {
  test('offers representative zero-build application scenarios', () => {
    expect(LYNX_XML_SCENARIOS.map(({ id }) => id)).toEqual([
      'counter',
      'travel-plan',
      'product-card',
      'weather-card',
      'todo-list',
      'template-counter',
      'style-preset-counter',
      'script-reuse-counter',
    ]);
    for (const scenario of LYNX_XML_SCENARIOS) {
      expect(scenario.source).toMatch(/^<!doctype lynx>/u);
      expect(scenario.source).toContain('<lynx engine-version="4.2">');
      expect(scenario.source).toContain('<script thread="main">');
      expect(scenario.source).toMatch(/<\/lynx>\s*$/u);
      expect(scenario.sourcePath).toMatch(/\.lynxml$/u);
      expect(scenario.source).not.toMatch(/\.mp[34][?"']/iu);
      expect(scenario.source).not.toContain('__SetClasses(page,');
      expect(scenario.source).not.toContain('const app = __CreateView');
      expect(scenario.source).not.toMatch(/\.page\s*\{/u);
      if (!scenario.templateSource) {
        expect(scenario.source).toMatch(
          /__AppendElement\(page, (?:card|scroll)\);/u,
        );
      }
      expect(scenario.source).not.toContain('<template>');
    }
    expect(LYNX_XML_SCENARIOS[1]!.source).toContain('__ReplaceElements');
    expect(LYNX_XML_SCENARIOS[3]!.source).toContain(
      '<script thread="background">',
    );
    expect(LYNX_XML_DEMOS_LIST_SOURCE.sections).toMatchObject([
      { title: 'Examples', layout: 'flow' },
    ]);
  });

  test('enables flex explicitly on every layout container', () => {
    for (const scenario of LYNX_XML_SCENARIOS) {
      for (const className of FLEX_LAYOUT_CLASSES[scenario.id] ?? []) {
        expectCssDeclaration(scenario.source, className, 'display: flex;');
      }
      for (const className of ROW_LAYOUT_CLASSES[scenario.id] ?? []) {
        expectCssDeclaration(
          scenario.source,
          className,
          'flex-direction: row;',
        );
      }
    }
  });

  test('uses the entry node itself as a vertical scroll view', () => {
    for (const scenario of LYNX_XML_SCENARIOS) {
      const node = scenario.templateSource ? 'element' : '(?:card|scroll)';
      expect(scenario.source).toMatch(
        new RegExp(`${node} = __CreateScrollView\\(pageId\\);`, 'u'),
      );
      expect(scenario.source).toMatch(
        new RegExp(
          `__SetAttribute\\(${node}, "scroll-orientation", "vertical"\\)`,
          'u',
        ),
      );
    }
  });

  test('enables HTML language support in the Lynx XML editor', () => {
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.editor.extensions).toHaveLength(1);
  });

  test('constructs a direct XML preview URL for each card', () => {
    const scenario = LYNX_XML_SCENARIOS[0]!;
    const previewUrl = new URL(
      LYNX_XML_DEMOS_LIST_SOURCE.createPreviewUrl({
        baseUrl: 'https://lynx-stack.dev/genui/',
        protocol: PROTOCOLS['lynx-xml'],
        scenario,
        theme: 'light',
      }),
    );

    expect(previewUrl.pathname).toBe('/genui/render.html');
    expect(previewUrl.searchParams.get('protocol')).toBe('lynx-xml');
    expect(previewUrl.searchParams.get('sourceUrl')).toBe(
      `https://lynx-stack.dev/genui/${scenario.sourcePath}`,
    );
  });

  test('keeps static sources shareable until the editor changes them', () => {
    const scenario = LYNX_XML_SCENARIOS[0]!;
    expect(
      LYNX_XML_DEMOS_PAGE_SOURCE.createScenarioPreviewInput(scenario),
    ).toEqual({
      source: scenario.source,
      sourcePath: scenario.sourcePath,
    });

    const edited = LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      editorEdited: true,
      editorValue: scenario.source.replace('WEEKEND EDIT', 'CUSTOM EDIT'),
      scenario,
    });
    expect(edited).toMatchObject({
      value: {
        previewInput: { sourcePath: undefined },
        playbackChunks: [],
      },
    });
  });

  test('converts templates with authored scripts at preview time and marks template list URLs', () => {
    const scenario = LYNX_XML_DEMOS_PAGE_SOURCE.findScenario(
      'template-counter',
    )!;
    const original = LYNX_XML_DEMOS_PAGE_SOURCE.getEditorValue(scenario);
    expect(original).toContain('<template>');
    expect(original).toContain('<script thread="main">');
    expect(original).toContain('nodes = createFragment(page, pageId);');
    expect(original).not.toContain('function createFragment(');
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue: original,
      editorEdited: false,
    })).toMatchObject({
      value: {
        previewInput: {
          source: scenario.source,
          sourcePath: undefined,
        },
      },
    });
    const previewUrl = new URL(LYNX_XML_DEMOS_LIST_SOURCE.createPreviewUrl({
      baseUrl: 'https://lynx-stack.dev/genui/',
      protocol: PROTOCOLS['lynx-xml'],
      scenario,
      theme: 'light',
    }));
    expect(previewUrl.searchParams.get('exampleId')).toBe('template-counter');
    expect(previewUrl.searchParams.get('sourceUrl')).toBe(
      'https://lynx-stack.dev/genui/demos/lynx-xml/template-counter.lynxml',
    );

    const editorValue = original.replace('Daily counter', 'Reading counter')
      .replace('count += 1;', 'count += 2;');
    const edited = LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue,
      editorEdited: true,
    });
    if (!('value' in edited)) throw new Error(edited.error);
    expect(edited.value.previewInput.sourcePath).toBeUndefined();
    expect(edited.value.previewInput.source).not.toContain('<template>');
    expect(edited.value.previewInput.source).toContain(
      '__CreateRawText("Reading counter")',
    );
    expect(edited.value.previewInput.source).toContain('count += 2;');
    const transformed = LYNX_XML_DEMOS_PAGE_SOURCE.editor.views[1]!;
    expect(transformed.editable).toBe(false);
    expect(transformed.getValue({ editorValue, scenario })).toBe(
      edited.value.previewInput.source,
    );

    const invalid = original.replace('</template>', '');
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue: invalid,
      editorEdited: true,
    })).toEqual({
      error: 'Fragment document contains an unclosed source block',
    });
    expect(transformed.getValue({ editorValue: invalid, scenario })).toContain(
      'Conversion failed: Fragment document contains an unclosed source block',
    );
  });

  test('preserves the example style preset when compiling editor changes', () => {
    const scenario = LYNX_XML_DEMOS_PAGE_SOURCE.findScenario(
      'style-preset-counter',
    )!;
    const original = LYNX_XML_DEMOS_PAGE_SOURCE.getEditorValue(scenario);
    expect(original).toContain('<template>');
    expect(original).not.toContain('display: flex;');
    expectCssDeclaration(
      scenario.source,
      'bg-white',
      'background-color: #ffffff;',
    );

    const editorValue = original.replace('bg-white', 'bg-indigo-50');
    const edited = LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue,
      editorEdited: true,
    });
    if (!('value' in edited)) throw new Error(edited.error);
    const { source, sourcePath } = edited.value.previewInput;
    expect(sourcePath).toBeUndefined();
    expect(source).not.toContain('<template>');
    expectCssDeclaration(source, 'bg-indigo-50', 'background-color: #eef2ff;');
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.editor.views[1]!.getValue({
      editorValue,
      scenario,
    })).toBe(source);
    const previewUrl = new URL(LYNX_XML_DEMOS_LIST_SOURCE.createPreviewUrl({
      baseUrl: 'https://lynx-stack.dev/genui/',
      protocol: PROTOCOLS['lynx-xml'],
      scenario,
      theme: 'light',
    }));
    expect(previewUrl.searchParams.get('exampleId')).toBe(scenario.id);
  });

  test('assembles ScriptReuse for list previews and edited source without exposing the intermediate artifact', () => {
    const scenario = LYNX_XML_DEMOS_PAGE_SOURCE.findScenario(
      'script-reuse-counter',
    )!;
    const original = LYNX_XML_DEMOS_PAGE_SOURCE.getEditorValue(scenario);
    const baseline = LYNX_XML_DEMOS_PAGE_SOURCE.findScenario(
      'style-preset-counter',
    )!.templateSource!;
    expect(original.split('<script thread="main">')[0]).toBe(
      baseline.split('<script thread="main">')[0],
    );
    expect(original).toContain('definePage({');
    expect(original).toContain('ctx.on(');
    expect(original).toContain('ctx.setText(');
    expect(original).not.toContain('function definePage(');
    expect(original).not.toContain('lynx.getEngine()');
    expect(original.length).toBeLessThan(baseline.length);
    expect(
      LYNX_XML_DEMOS_PAGE_SOURCE.createScenarioPreviewInput(scenario),
    ).toEqual({ source: scenario.source, sourcePath: undefined });
    const previewUrl = new URL(LYNX_XML_DEMOS_LIST_SOURCE.createPreviewUrl({
      baseUrl: 'https://lynx-stack.dev/genui/',
      protocol: PROTOCOLS['lynx-xml'],
      scenario,
      theme: 'light',
    }));
    expect(previewUrl.searchParams.get('exampleId')).toBe(scenario.id);

    const editorValue = original.replace('count += 1;', 'count += 2;')
      .replace('bg-white', 'bg-indigo-50');
    const edited = LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue,
      editorEdited: true,
    });
    if (!('value' in edited)) throw new Error(edited.error);
    const { source, sourcePath } = edited.value.previewInput;
    expect(sourcePath).toBeUndefined();
    expect(source).not.toContain('<template>');
    expect(source).toContain('function definePage(');
    expect(source).toContain('count += 2;');
    expectCssDeclaration(source, 'bg-indigo-50', 'background-color: #eef2ff;');
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.editor.views[1]!.getValue({
      editorValue,
      scenario,
    })).toBe(source);
    expect(LYNX_XML_DEMOS_PAGE_SOURCE.commit({
      scenario,
      editorValue: original.replace('definePage({', 'missingHelper({'),
      editorEdited: true,
    })).toMatchObject({
      error: 'ScriptReuse requires one top-level definePage({...}) call',
    });
  });

  test.each([
    'template-counter',
    'style-preset-counter',
    'script-reuse-counter',
  ])(
    'renders %s once, handles counter events, and cleans up',
    (id) => {
      const scenario = LYNX_XML_DEMOS_PAGE_SOURCE.findScenario(
        id,
      )!;
      interface Element {
        tag: string;
        children: (Element | string)[];
      }
      const create = (tag: string): Element => ({ tag, children: [] });
      const page = create('page');
      const byId = new Map<string, Element>();
      const taps = new Map<Element, () => void>();
      const lifecycle = new Map<string, () => void>();
      const flush = rstest.fn();
      const context = {
        lynx: {
          getEngine: () => ({
            addEventListener: (name: string, handler: () => void) =>
              lifecycle.set(name, handler),
            removeEventListener: (name: string) => lifecycle.delete(name),
          }),
        },
        __CreatePage: () => page,
        __GetElementUniqueID: () => 0,
        __CreateScrollView: () => create('scroll-view'),
        __CreateView: () => create('view'),
        __CreateText: () => create('text'),
        __CreateRawText: (text: string) => text,
        __SetClasses: rstest.fn(),
        __SetAttribute: rstest.fn(),
        __SetID: (node: Element, id: string) => byId.set(id, node),
        __AppendElement: (parent: Element, child: Element | string) =>
          parent.children.push(child),
        __GetChildren: (node: Element) => node.children,
        __ReplaceElements: (node: Element, children: Element['children']) => {
          node.children = children;
        },
        __AddEventListener: (
          node: Element,
          _name: string,
          handler: () => void,
        ) => taps.set(node, handler),
        __RemoveEventListener: (node: Element) => taps.delete(node),
        __FlushElementTree: flush,
      };
      const script = scenario.source.split('<script thread="main">')[1]!.split(
        '</script>',
      )[0]!;
      runInNewContext(script, context);
      lifecycle.get('__RenderPage')!();
      lifecycle.get('__RenderPage')!();
      expect(page.children).toHaveLength(1);
      expect(page.children[0]).toMatchObject({ tag: 'scroll-view' });
      expect(JSON.stringify(page)).toContain('Daily counter');
      expect(JSON.stringify(page)).toContain('Steps to go');
      expect(flush).not.toHaveBeenCalled();
      expect(byId.get('count')?.children).toEqual(['8']);
      expect(taps.size).toBe(3);
      const tap = (id: string) => taps.get(byId.get(id)!)!();
      tap('increment');
      expect(byId.get('count')?.children).toEqual(['9']);
      expect(byId.get('remaining')?.children).toEqual(['3']);
      tap('decrement');
      expect(byId.get('count')?.children).toEqual(['8']);
      for (let step = 0; step < 4; step++) tap('increment');
      expect(byId.get('count')?.children).toEqual(['12']);
      expect(byId.get('note')?.children).toEqual(['Daily goal reached!']);
      expect(byId.get('remaining')?.children).toEqual(['0']);
      tap('reset');
      tap('decrement');
      expect(byId.get('count')?.children).toEqual(['0']);
      expect(byId.get('remaining')?.children).toEqual(['12']);
      expect(flush).toHaveBeenCalledTimes(8);
      lifecycle.get('__DestroyLifetime')!();
      expect(taps.size).toBe(0);
      expect(lifecycle.size).toBe(0);
    },
  );
});
