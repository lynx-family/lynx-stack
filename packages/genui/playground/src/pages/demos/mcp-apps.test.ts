// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  MCP_APPS_DEMOS_LIST_SOURCE,
  MCP_APPS_DEMOS_PAGE_SOURCE,
  MCP_APPS_SCENARIOS,
} from './mcp-apps.js';
import { PROTOCOLS } from '../../utils/protocol.js';

describe('MCP Apps templates', () => {
  test('lists every renderer already registered by the playground host', () => {
    expect(MCP_APPS_SCENARIOS.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'weather', title: 'Weather Card' },
      { id: 'product', title: 'Product Card' },
    ]);
    expect(MCP_APPS_DEMOS_LIST_SOURCE.sections).toMatchObject([
      { title: 'Templates', layout: 'flow' },
    ]);
  });

  test('builds an MCP Apps preview for every template', () => {
    for (const scenario of MCP_APPS_SCENARIOS) {
      const url = new URL(MCP_APPS_DEMOS_LIST_SOURCE.createPreviewUrl({
        baseUrl: 'https://lynx-stack.dev/genui/',
        protocol: PROTOCOLS['mcp-apps'],
        scenario,
        theme: 'dark',
      }));
      expect(url.searchParams.get('protocol')).toBe('mcp-apps');
      expect(url.searchParams.get('demoUrl')).toBe('./mcp-apps.web.js');
      expect(url.searchParams.get('theme')).toBe('dark');
      expect(url.searchParams.get('initData')).toBeTruthy();
    }
  });

  test('uses the selected template as editable detail preview data', () => {
    const scenario = MCP_APPS_SCENARIOS[0];
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const input = MCP_APPS_DEMOS_PAGE_SOURCE.createScenarioPreviewInput(
      scenario,
    );
    expect(MCP_APPS_DEMOS_PAGE_SOURCE.createPreviewSource({
      input,
      isPlaybackActive: false,
      protocol: PROTOCOLS['mcp-apps'],
      theme: 'light',
    })).toEqual({
      kind: 'mcp-apps',
      mcpAppData: scenario.renderData,
      theme: 'light',
    });
  });

  test('validates edited template data before rendering', () => {
    for (const scenario of MCP_APPS_SCENARIOS) {
      expect(MCP_APPS_DEMOS_PAGE_SOURCE.commit({
        editorValue: JSON.stringify(scenario.renderData),
        editorEdited: true,
        scenario,
      })).toMatchObject({
        value: {
          previewInput: { renderer: scenario.renderData.renderer },
          playbackChunks: [],
        },
      });
    }

    const scenario = MCP_APPS_SCENARIOS[0];
    expect(scenario).toBeDefined();
    if (!scenario) return;
    expect(MCP_APPS_DEMOS_PAGE_SOURCE.commit({
      editorValue: '{',
      editorEdited: true,
      scenario,
    })).toHaveProperty('error');
    expect(MCP_APPS_DEMOS_PAGE_SOURCE.commit({
      editorValue: JSON.stringify({
        renderer: 'unknown',
        input: {},
        result: {},
      }),
      editorEdited: true,
      scenario,
    })).toEqual({
      error:
        'Expected valid render data for the weather or product MCP Apps template.',
    });
  });
});
