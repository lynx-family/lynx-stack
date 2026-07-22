// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { decodeBase64Url } from './base64url.js';
import {
  OPENUI_INLINE_RENDER_URL_MAX_LENGTH,
  buildMcpAppsRenderUrl,
  buildOpenUIRenderUrl,
  canInlineOpenUIRenderUrl,
  hasShareableA2UIRenderPayload,
} from './renderUrl.js';

describe('A2UI render payloads', () => {
  test('treats runtime-built inline messages as shareable', () => {
    expect(hasShareableA2UIRenderPayload({
      messages: [{ createSurface: { surfaceId: 'default' } }],
    })).toBe(true);
  });

  test('requires content or an external payload reference', () => {
    expect(hasShareableA2UIRenderPayload({ messages: [] })).toBe(false);
    expect(hasShareableA2UIRenderPayload({ messages: undefined })).toBe(false);
    expect(hasShareableA2UIRenderPayload({
      demoId: 'mcp-app',
      messages: [],
    })).toBe(true);
    expect(hasShareableA2UIRenderPayload({
      messages: [],
      messagesUrl: 'https://example.com/messages.json',
    })).toBe(true);
  });
});

describe('OpenUI render URLs', () => {
  test('marks oversized inline rawText URLs as unsafe', () => {
    const rawText = 'root = Stack([])\n'.repeat(600);
    const url = buildOpenUIRenderUrl({
      rawText,
    }, 'https://lynx-stack.dev/genui/');

    expect(url.length).toBeGreaterThan(OPENUI_INLINE_RENDER_URL_MAX_LENGTH);
    expect(canInlineOpenUIRenderUrl(url)).toBe(false);
  });

  test('keeps rawTextUrl render URLs short', () => {
    const url = buildOpenUIRenderUrl({
      rawTextUrl:
        'https://example.supabase.co/storage/v1/object/public/genui/openui/id/raw.txt',
    }, 'https://lynx-stack.dev/genui/');

    expect(canInlineOpenUIRenderUrl(url)).toBe(true);
    expect(url).toContain('rawTextUrl=');
    expect(url).not.toContain('rawText=');
  });

  test('forwards the selected theme to the OpenUI runtime', () => {
    const url = buildOpenUIRenderUrl({
      rawText: 'root = Stack([])',
      theme: 'dark',
      instant: true,
      liveAction: true,
    }, 'https://lynx-stack.dev/genui/');

    expect(new URL(url).searchParams.get('theme')).toBe('dark');
    expect(new URL(url).searchParams.get('instant')).toBe('1');
    expect(new URL(url).searchParams.get('liveAction')).toBe('1');
  });
});

describe('MCP Apps render URLs', () => {
  test('encodes MCP Apps data for the Lynx renderer', () => {
    const mcpAppData = {
      renderer: 'weather',
      input: { city: 'Hangzhou' },
      result: { summary: 'Sunny', weather: { city: 'Hangzhou' } },
    };
    const url = new URL(buildMcpAppsRenderUrl({
      mcpAppData,
      theme: 'dark',
    }, 'https://lynx-stack.dev/genui/'));

    expect(url.searchParams.get('protocol')).toBe('mcp-apps');
    expect(url.searchParams.get('demoUrl')).toBe('./mcp-apps.web.js');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.has('liveAction')).toBe(false);
    const initData = url.searchParams.get('initData');
    expect(initData).toBeTruthy();
    if (!initData) return;
    expect(JSON.parse(decodeBase64Url(initData))).toEqual({
      protocol: 'mcp-apps',
      demoUrl: './mcp-apps.web.js',
      mcpAppData,
      theme: 'dark',
    });
  });
});
