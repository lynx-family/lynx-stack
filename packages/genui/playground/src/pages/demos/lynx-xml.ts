// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { html } from '@codemirror/lang-html';

import type { DemosListSource } from './DemosList.js';
import type { DemosPageSource } from './type.js';
import counterSource from '../../mock/lynx-xml/counter.lynxml?raw';
import productCardSource from '../../mock/lynx-xml/product-card.lynxml?raw';
import todoListSource from '../../mock/lynx-xml/todo-list.lynxml?raw';
import travelPlanSource from '../../mock/lynx-xml/travel-plan.lynxml?raw';
import weatherCardSource from '../../mock/lynx-xml/weather-card.lynxml?raw';
import { buildLynxXmlRenderUrl } from '../../utils/renderUrl.js';

export interface LynxXmlScenario {
  id: string;
  title: string;
  description: string;
  badge: string;
  sourcePath: string;
  source: string;
}

interface LynxXmlPreviewInput {
  source: string;
  sourcePath?: string;
}

const htmlExtensions = [html({ autoCloseTags: false, selfClosingTags: true })];

export const LYNX_XML_SCENARIOS: readonly LynxXmlScenario[] = [
  {
    id: 'counter',
    title: 'Counter',
    description:
      'Updates local state and visible values immediately on the main thread.',
    badge: 'Main thread',
    sourcePath: 'demos/lynx-xml/counter.lynxml',
    source: counterSource,
  },
  {
    id: 'travel-plan',
    title: 'Travel Plan',
    description:
      'Switches days and replaces the complete itinerary subtree on selection.',
    badge: 'Re-render',
    sourcePath: 'demos/lynx-xml/travel-plan.lynxml',
    source: travelPlanSource,
  },
  {
    id: 'product-card',
    title: 'Product Card',
    description:
      'Selects a color, changes quantity, and confirms a purchase action.',
    badge: 'Selection',
    sourcePath: 'demos/lynx-xml/product-card.lynxml',
    source: productCardSource,
  },
  {
    id: 'weather-card',
    title: 'Weather Card',
    description:
      'Computes a forecast on the background thread and returns a UI patch.',
    badge: 'Background',
    sourcePath: 'demos/lynx-xml/weather-card.lynxml',
    source: weatherCardSource,
  },
  {
    id: 'todo-list',
    title: 'Todo List',
    description:
      'Adds, filters, toggles, and rebuilds a dynamic list with safe cleanup.',
    badge: 'Dynamic list',
    sourcePath: 'demos/lynx-xml/todo-list.lynxml',
    source: todoListSource,
  },
];

export const LYNX_XML_DEMOS_LIST_SOURCE = {
  title: 'Lynx XML Showcase',
  description:
    'Explore zero-build Lynx interfaces authored as a single XML artifact with Lynx CSS and main-thread Element PAPI JavaScript.',
  scenarios: LYNX_XML_SCENARIOS,
  sections: [
    {
      id: 'typical-apps',
      title: 'Examples',
      scenarios: LYNX_XML_SCENARIOS,
      layout: 'flow',
    },
  ],
  createPreviewUrl({ baseUrl, scenario, theme }) {
    return buildLynxXmlRenderUrl({
      sourceUrl: new URL(scenario.sourcePath, baseUrl).toString(),
      theme,
    }, baseUrl);
  },
  createResetKey({ protocol, theme }) {
    return `${protocol.name}|${theme}`;
  },
} satisfies DemosListSource<LynxXmlScenario>;

function findScenario(id?: string): LynxXmlScenario | undefined {
  if (!id) return undefined;
  return LYNX_XML_SCENARIOS.find((scenario) => scenario.id === id);
}

export const LYNX_XML_DEMOS_PAGE_SOURCE = {
  scenarios: LYNX_XML_SCENARIOS,
  findScenario,
  getEditorValue(scenario) {
    return scenario.source;
  },
  createScenarioPreviewInput(scenario) {
    return { source: scenario.source, sourcePath: scenario.sourcePath };
  },
  commit({ editorEdited, editorValue, scenario }) {
    if (!editorValue.trim()) return { error: 'Lynx XML source is empty.' };
    return {
      value: {
        previewInput: {
          source: editorValue,
          sourcePath: !editorEdited && scenario?.source === editorValue
            ? scenario.sourcePath
            : undefined,
        },
        playbackChunks: [],
        meta: undefined,
      },
    };
  },
  createPreviewSource({ input, theme }) {
    return {
      kind: 'lynx-xml',
      source: input.source,
      sourcePath: input.sourcePath,
      theme,
    };
  },
  formatPlaybackChunk(chunk) {
    return chunk;
  },
  playback: false,
  emptyEditorValue: '',
  emptyPlaybackError: 'Lynx XML artifacts are rendered as a whole.',
  resetPlaybackOnFill: true,
  editor: {
    title: 'Lynx XML Source',
    badge: 'XML',
    basicSetup: {
      lineNumbers: true,
      foldGutter: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: false,
    },
    extensions: htmlExtensions,
    splitterAriaLabel: 'Resize Playback and Lynx XML panels',
    panelResizeAriaLabel: 'Resize Lynx XML and preview panels',
    emptyPreviewTitle: 'Select a Lynx XML example to preview',
  },
} satisfies DemosPageSource<
  LynxXmlScenario,
  LynxXmlPreviewInput,
  string,
  undefined
>;
