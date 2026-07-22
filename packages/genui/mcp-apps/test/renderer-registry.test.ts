// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { readMcpAppsHostData } from '../src/render/data.js';
import {
  createAppRendererRegistry,
  defineAppRenderer,
  readAppMarkdown,
  readAppRenderData,
} from '../src/render/index.js';

const RENDERER = defineAppRenderer({
  id: 'example',
  parseResult(value: unknown) {
    return typeof value === 'string' ? value : null;
  },
  component() {
    return null;
  },
  invalidResultMessage: 'Invalid example result.',
});

describe('MCP Apps render data', () => {
  test('prefers reactive frame init data over global props', () => {
    expect(readMcpAppsHostData(
      {
        embedded: true,
        mcpAppData: { renderer: 'frame' },
        theme: 'dark',
      },
      {
        mcpAppData: { renderer: 'global' },
        theme: 'light',
      },
    )).toEqual({
      embedded: true,
      mcpAppData: { renderer: 'frame' },
      theme: 'dark',
    });
  });

  test('falls back to standalone global props', () => {
    expect(readMcpAppsHostData(undefined, {
      mcpAppData: { renderer: 'global' },
      theme: 'dark',
    })).toEqual({
      embedded: false,
      mcpAppData: { renderer: 'global' },
      theme: 'dark',
    });
  });

  test('reads URL-encoded Markdown data', () => {
    const value = encodeURIComponent(JSON.stringify({ markdown: '# Lynx' }));

    expect(readAppMarkdown(value)).toBe('# Lynx');
  });

  test('reads renderer data without interpreting its result', () => {
    expect(readAppRenderData({
      renderer: 'example',
      input: { query: 'Lynx' },
      result: 'answer',
    })).toEqual({
      renderer: 'example',
      input: { query: 'Lynx' },
      result: 'answer',
    });
  });
});

describe('createAppRendererRegistry', () => {
  test('resolves data with the matching local renderer', () => {
    const registry = createAppRendererRegistry([RENDERER]);

    expect(registry.resolveRenderData({
      renderer: 'example',
      input: { query: 'Lynx' },
      result: 'answer',
    })).toEqual({
      renderer: RENDERER,
      input: { query: 'Lynx' },
      result: 'answer',
    });
  });

  test('rejects unknown renderers and invalid results', () => {
    const registry = createAppRendererRegistry([RENDERER]);

    expect(registry.resolveRenderData({
      renderer: 'missing',
      input: {},
      result: 'answer',
    })).toBeNull();
    expect(registry.resolveRenderData({
      renderer: 'example',
      input: {},
      result: 42,
    })).toBeNull();
  });

  test('rejects duplicate renderer ids', () => {
    expect(() => createAppRendererRegistry([RENDERER, RENDERER])).toThrow(
      'Duplicate MCP Apps renderer id: example',
    );
  });
});
