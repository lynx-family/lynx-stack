// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { json } from '@codemirror/lang-json';

import { readAppRenderData } from '@lynx-js/genui/mcp-apps/render';
import type { AppRenderData } from '@lynx-js/genui/mcp-apps/render';

import type { DemosListSource } from './DemosList.js';
import type { DemosPageSource } from './type.js';
import {
  PRODUCT_RENDERER_ID,
  callProductApi,
  parseProductApiResult,
} from '../../../lynx-src/mcp-apps/product/api.js';
import {
  WEATHER_RENDERER_ID,
  callWeatherApi,
  parseWeatherApiResult,
} from '../../../lynx-src/mcp-apps/weather/api.js';
import { buildMcpAppsRenderUrl } from '../../utils/renderUrl.js';

interface McpAppsScenario {
  id: string;
  title: string;
  badge: string;
  renderData: AppRenderData;
}

const weatherInput = { city: 'Hangzhou', unit: 'celsius' };
const productInput = { productId: 'limited-edition-sneaker' };

export const MCP_APPS_SCENARIOS: readonly McpAppsScenario[] = [
  {
    id: WEATHER_RENDERER_ID,
    title: 'Weather Card',
    badge: 'Template',
    renderData: {
      renderer: WEATHER_RENDERER_ID,
      input: weatherInput,
      result: callWeatherApi(weatherInput),
    },
  },
  {
    id: PRODUCT_RENDERER_ID,
    title: 'Product Card',
    badge: 'Template',
    renderData: {
      renderer: PRODUCT_RENDERER_ID,
      input: productInput,
      result: callProductApi(productInput),
    },
  },
];

export const MCP_APPS_DEMOS_LIST_SOURCE = {
  title: 'MCP Apps Templates',
  description:
    'Explore the renderer templates already registered by the MCP Apps client. Open a template to inspect its render data and preview it on Web or Lynx.',
  scenarios: MCP_APPS_SCENARIOS,
  sections: [
    {
      id: 'templates',
      title: 'Templates',
      scenarios: MCP_APPS_SCENARIOS,
      layout: 'flow',
    },
  ],
  createPreviewUrl({ baseUrl, scenario, theme }) {
    return buildMcpAppsRenderUrl({
      mcpAppData: scenario.renderData,
      theme,
    }, baseUrl);
  },
  createResetKey({ protocol, theme }) {
    return `${protocol.name}|${theme}`;
  },
} satisfies DemosListSource<McpAppsScenario>;

function findScenario(id?: string): McpAppsScenario | undefined {
  if (!id) return undefined;
  return MCP_APPS_SCENARIOS.find((scenario) => scenario.id === id);
}

function parseKnownRenderData(value: unknown): AppRenderData | null {
  const renderData = readAppRenderData(value);
  if (!renderData) return null;

  if (renderData.renderer === WEATHER_RENDERER_ID) {
    const result = parseWeatherApiResult(renderData.result);
    return result ? { ...renderData, result } : null;
  }
  if (renderData.renderer === PRODUCT_RENDERER_ID) {
    const result = parseProductApiResult(renderData.result);
    return result ? { ...renderData, result } : null;
  }
  return null;
}

const jsonExtensions = [json()];

export const MCP_APPS_DEMOS_PAGE_SOURCE = {
  scenarios: MCP_APPS_SCENARIOS,
  findScenario,
  getEditorValue(scenario) {
    return JSON.stringify(scenario.renderData, null, 2);
  },
  createScenarioPreviewInput(scenario) {
    return scenario.renderData;
  },
  commit({ editorValue }) {
    let value: unknown;
    try {
      value = JSON.parse(editorValue) as unknown;
    } catch (error) {
      return { error: `Invalid JSON: ${String(error)}` };
    }

    const renderData = parseKnownRenderData(value);
    if (!renderData) {
      return {
        error:
          'Expected valid render data for the weather or product MCP Apps template.',
      };
    }

    return {
      value: {
        previewInput: renderData,
        playbackChunks: [],
        meta: undefined,
      },
    };
  },
  createPreviewSource({ input, theme }) {
    return {
      kind: 'mcp-apps',
      mcpAppData: input,
      theme,
    };
  },
  formatPlaybackChunk(chunk) {
    return chunk;
  },
  playback: false,
  emptyEditorValue: '{}',
  emptyPlaybackError: 'MCP Apps templates are rendered as a whole.',
  resetPlaybackOnFill: true,
  editor: {
    title: 'MCP App Render Data',
    badge: 'JSON',
    extensions: jsonExtensions,
    basicSetup: {
      lineNumbers: true,
      foldGutter: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
    },
    splitterAriaLabel: 'Resize Playback and MCP App data panels',
    panelResizeAriaLabel: 'Resize MCP App data and preview panels',
    emptyPreviewTitle: 'Select an MCP Apps template to preview',
  },
} satisfies DemosPageSource<
  McpAppsScenario,
  AppRenderData,
  string,
  undefined
>;
