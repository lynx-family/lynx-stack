// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { html } from '@codemirror/lang-html';

import { compileLynxXmlFragment } from '@lynx-js/genui/lynx-xml';

import type { DemosListSource } from './DemosList.js';
import type { DemosPageSource } from './type.js';
import counterSource from '../../mock/lynx-xml/counter.lynxml?raw';
import productCardSource from '../../mock/lynx-xml/product-card.lynxml?raw';
import templateCounterSource from '../../mock/lynx-xml/template-counter.lynxml?raw';
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
  templateSource?: string;
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
  {
    id: 'template-counter',
    title: 'Template Counter',
    description:
      'Converts a template to Element PAPI at runtime, with counter events authored in the same XML document.',
    badge: 'Template',
    sourcePath: 'demos/lynx-xml/template-counter.lynxml',
    source: compileLynxXmlFragment(templateCounterSource).text,
    templateSource: templateCounterSource,
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
      exampleId: scenario.templateSource ? scenario.id : undefined,
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

function compileEditorSource(
  source: string,
  scenario?: LynxXmlScenario,
): string {
  return scenario?.templateSource === undefined
    ? source
    : compileLynxXmlFragment(source).text;
}

export const LYNX_XML_DEMOS_PAGE_SOURCE = {
  scenarios: LYNX_XML_SCENARIOS,
  findScenario,
  getEditorValue(scenario) {
    return scenario.templateSource ?? scenario.source;
  },
  createScenarioPreviewInput(scenario) {
    return {
      source: scenario.source,
      sourcePath: scenario.templateSource ? undefined : scenario.sourcePath,
    };
  },
  commit({ editorEdited, editorValue, scenario }) {
    if (!editorValue.trim()) return { error: 'Lynx XML source is empty.' };
    let source: string;
    try {
      source = compileEditorSource(editorValue, scenario);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    return {
      value: {
        previewInput: {
          source,
          sourcePath: !scenario?.templateSource && !editorEdited
              && scenario?.source === source
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
    iconOnlyActions: true,
    defaultView: 'original',
    views: [
      {
        id: 'original',
        label: 'Original',
        title: 'Edit the authored Lynx XML source',
        editable: true,
        getValue: ({ editorValue }) => editorValue,
      },
      {
        id: 'transformed',
        label: 'Transformed',
        title: 'Inspect the Element PAPI artifact used for rendering',
        editable: false,
        getValue: ({ editorValue, scenario }) => {
          if (!editorValue.trim()) return '';
          try {
            return compileEditorSource(editorValue, scenario);
          } catch (error) {
            return `Conversion failed: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        },
      },
    ],
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
