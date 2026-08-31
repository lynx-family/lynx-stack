// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  LYNX_XML_DEMOS_LIST_SOURCE,
  LYNX_XML_DEMOS_PAGE_SOURCE,
  LYNX_XML_SCENARIOS,
} from './lynx-xml.js';
import { PROTOCOLS } from '../../utils/protocol.js';

const FLEX_LAYOUT_CLASSES: Readonly<Record<string, readonly string[]>> = {
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
      expect(scenario.source).toMatch(
        /__AppendElement\(page, (?:card|scroll)\);/u,
      );
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
      expect(scenario.source).toMatch(
        /const (?:card|scroll) = __CreateScrollView\(pageId\);/u,
      );
      expect(scenario.source).toMatch(
        /__SetAttribute\((?:card|scroll), "scroll-orientation", "vertical"\)/u,
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
});
