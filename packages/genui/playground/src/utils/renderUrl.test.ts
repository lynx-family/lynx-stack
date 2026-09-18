// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { decodeBase64Url } from './base64url.js';
import { PROTOCOLS } from './protocol.js';
import {
  A2UI_INLINE_RENDER_URL_MAX_LENGTH,
  OPENUI_INLINE_RENDER_URL_MAX_LENGTH,
  buildLynxXmlRenderUrl,
  buildMcpAppsRenderUrl,
  buildOpenUIRenderUrl,
  buildRenderUrl,
  canInlineA2UIRenderUrl,
  canInlineOpenUIRenderUrl,
  createLocalA2UIMessagesPayload,
  createLocalA2UIMessagesPayloadCache,
  createLocalLynxXmlSourcePayload,
  hasExternalA2UIRenderPayload,
  hasShareableA2UIRenderPayload,
  isPortableA2UIMessagesUrl,
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

  test('requires a non-blank external payload reference', () => {
    expect(hasExternalA2UIRenderPayload({})).toBe(false);
    expect(hasExternalA2UIRenderPayload({ demoId: '   ' })).toBe(false);
    expect(hasExternalA2UIRenderPayload({ messagesUrl: '' })).toBe(false);
    expect(hasExternalA2UIRenderPayload({
      messagesUrl: 'blob:https://example.com/local-messages',
    })).toBe(false);
    expect(hasExternalA2UIRenderPayload({ demoId: 'weather' })).toBe(true);
    expect(hasExternalA2UIRenderPayload({
      messagesUrl: 'https://example.com/messages.json',
    })).toBe(true);
    expect(isPortableA2UIMessagesUrl('/messages.json')).toBe(true);
    expect(isPortableA2UIMessagesUrl('data:application/json,[]')).toBe(false);
    expect(isPortableA2UIMessagesUrl('javascript:void(0)')).toBe(false);
  });

  test('loads local JSON from a Blob URL without embedding messages', async () => {
    const messages = [{ text: '北京'.repeat(4_000) }];
    let blob: { text: () => Promise<string>; type: string } | undefined;
    const revoked: string[] = [];
    const localPayload = createLocalA2UIMessagesPayload(messages, {
      createObjectURL(value) {
        blob = value;
        return 'blob:https://lynx-stack.dev/local-messages';
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    });
    expect(blob?.type).toBe('application/json');
    expect(blob).toBeDefined();
    if (!blob) return;
    expect(JSON.parse(await blob.text())).toEqual(messages);

    const url = new URL(buildRenderUrl({
      protocol: PROTOCOLS.a2ui,
      demoUrl: './a2ui.web.js',
      messages,
      messagesUrl: localPayload.messagesUrl,
      theme: 'dark',
      speed: 2,
      liveAction: true,
      playbackMode: true,
    }, 'https://lynx-stack.dev/genui/'));

    expect(url.searchParams.get('protocol')).toBe('a2ui');
    expect(url.searchParams.get('demoUrl')).toBe('./a2ui.web.js');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.get('speed')).toBe('2');
    expect(url.searchParams.get('liveAction')).toBe('1');
    expect(url.searchParams.get('playbackMode')).toBe('1');
    expect(url.searchParams.has('messages')).toBe(false);
    expect(url.searchParams.get('messagesUrl')).toBe(
      'blob:https://lynx-stack.dev/local-messages',
    );
    expect(url.searchParams.has('actionMocks')).toBe(false);
    expect(url.searchParams.has('initData')).toBe(true);
    expect(canInlineA2UIRenderUrl(url.toString())).toBe(true);

    localPayload.dispose();
    localPayload.dispose();
    expect(revoked).toEqual([
      'blob:https://lynx-stack.dev/local-messages',
    ]);
  });

  test('keeps local Blob URLs alive until their runtime finishes loading', () => {
    let nextId = 0;
    const revoked: string[] = [];
    let scheduledRelease: (() => void) | undefined;
    const registry = {
      createObjectURL() {
        nextId += 1;
        return `blob:https://lynx-stack.dev/local-${nextId}`;
      },
      revokeObjectURL(url: string) {
        revoked.push(url);
      },
    };
    const cache = createLocalA2UIMessagesPayloadCache({
      createPayload: (messages) =>
        createLocalA2UIMessagesPayload(messages, registry),
      releaseTimeoutMs: 100,
      scheduleRelease: (callback) => {
        scheduledRelease = callback;
        return callback;
      },
      cancelRelease: (handle) => {
        if (scheduledRelease === handle) scheduledRelease = undefined;
      },
    });
    const firstMessages = [{ text: 'first' }];
    const first = cache.ensure(firstMessages);

    expect(cache.ensure(firstMessages)).toBe(first);
    expect(revoked).toEqual([]);

    const second = cache.ensure([{ text: 'second' }]);
    expect(second.messagesUrl).not.toBe(first.messagesUrl);
    expect(revoked).toEqual([]);
    expect(scheduledRelease).toBeDefined();

    cache.markLoaded(first.messagesUrl);
    expect(revoked).toEqual([]);

    cache.markLoaded(second.messagesUrl);
    expect(revoked).toEqual([first.messagesUrl]);
    expect(scheduledRelease).toBeUndefined();

    cache.clear();
    expect(revoked).toEqual([first.messagesUrl]);
    scheduledRelease?.();
    expect(revoked).toEqual([first.messagesUrl, second.messagesUrl]);

    const orphaned = cache.ensure([{ text: 'orphaned' }]);
    cache.clear();
    expect(revoked).not.toContain(orphaned.messagesUrl);
    scheduledRelease?.();
    expect(revoked).toContain(orphaned.messagesUrl);

    cache.dispose();
    expect(revoked).toEqual([
      first.messagesUrl,
      second.messagesUrl,
      orphaned.messagesUrl,
    ]);
  });

  test('marks oversized Chinese and image payload URLs as unsafe', () => {
    const url = buildRenderUrl({
      protocol: PROTOCOLS.a2ui,
      demoUrl: './a2ui.web.js',
      messages: [{
        updateDataModel: {
          path: '/weather',
          value: {
            description: '北京今天晴朗'.repeat(2_000),
            imageUrl: `https://image.example.com/${'a'.repeat(1_000)}`,
          },
        },
      }],
    }, 'https://lynx-stack.dev/genui/');

    expect(url.length).toBeGreaterThan(A2UI_INLINE_RENDER_URL_MAX_LENGTH);
    expect(canInlineA2UIRenderUrl(url)).toBe(false);
  });

  test('keeps external A2UI payload URLs short without embedding messages', () => {
    const url = new URL(buildRenderUrl({
      protocol: PROTOCOLS.a2ui,
      demoUrl: './a2ui.web.js',
      messagesUrl: 'https://storage.example.com/a2ui/id/messages.json',
      messages: [{ text: '北京'.repeat(4_000) }],
    }, 'https://lynx-stack.dev/genui/'));

    expect(canInlineA2UIRenderUrl(url.toString())).toBe(true);
    expect(url.searchParams.get('messagesUrl')).toBe(
      'https://storage.example.com/a2ui/id/messages.json',
    );
    expect(url.searchParams.has('messages')).toBe(false);
    const initData = url.searchParams.get('initData');
    expect(initData).toBeTruthy();
    if (!initData) return;
    expect(JSON.parse(decodeBase64Url(initData))).toEqual({
      protocol: 'a2ui',
      demoUrl: './a2ui.web.js',
      messagesUrl: 'https://storage.example.com/a2ui/id/messages.json',
    });
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
      rawTextUrl: 'https://storage.example.com/openui/id/raw.txt',
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

describe('Lynx XML render URLs', () => {
  test('creates disposable XML-only Blob URLs for direct LynxView input', async () => {
    const readBlobContents: Array<() => Promise<string>> = [];
    const blobTypes: string[] = [];
    const lifecycle: string[] = [];
    let nextId = 0;
    const registry = {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      createObjectURL(blob: Blob) {
        nextId += 1;
        readBlobContents.push(() => blob.text());
        blobTypes.push(blob.type);
        lifecycle.push(`create:${nextId}`);
        return `blob:https://lynx-stack.dev/lynx-xml-${nextId}`;
      },
      revokeObjectURL(url: string) {
        lifecycle.push(`revoke:${url}`);
      },
    };

    const firstSource = '<lynx id="first"></lynx>';
    const first = createLocalLynxXmlSourcePayload(firstSource, registry);
    const firstRenderUrl = new URL(buildLynxXmlRenderUrl({
      sourceUrl: first.sourceUrl,
    }, 'https://lynx-stack.dev/genui/'));

    const secondSource = '<lynx id="second"></lynx>';
    const second = createLocalLynxXmlSourcePayload(secondSource, registry);
    const secondRenderUrl = new URL(buildLynxXmlRenderUrl({
      sourceUrl: second.sourceUrl,
    }, 'https://lynx-stack.dev/genui/'));

    expect(firstRenderUrl.searchParams.get('sourceUrl')).toBe(first.sourceUrl);
    expect(secondRenderUrl.searchParams.get('sourceUrl')).toBe(
      second.sourceUrl,
    );
    expect(second.sourceUrl).not.toBe(first.sourceUrl);
    expect(lifecycle).toEqual(['create:1', 'create:2']);
    expect(lifecycle).not.toContain(`revoke:${second.sourceUrl}`);
    expect(blobTypes).toEqual([
      'application/xml;charset=utf-8',
      'application/xml;charset=utf-8',
    ]);
    expect(await Promise.all(readBlobContents.map((read) => read()))).toEqual([
      firstSource,
      secondSource,
    ]);

    first.dispose();
    second.dispose();
    expect(lifecycle.slice(-2)).toEqual([
      `revoke:${first.sourceUrl}`,
      `revoke:${second.sourceUrl}`,
    ]);
  });

  test('loads the XML artifact URL directly in the Lynx runtime', () => {
    const sourceUrl =
      'https://lynx-stack.dev/genui/demos/lynx-xml/travel-plan.lynxml';
    const url = new URL(buildLynxXmlRenderUrl({
      sourceUrl,
      theme: 'dark',
    }, 'https://lynx-stack.dev/genui/'));

    expect(url.pathname).toBe('/genui/render.html');
    expect(url.searchParams.get('protocol')).toBe('lynx-xml');
    expect(url.searchParams.get('sourceUrl')).toBe(sourceUrl);
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.has('initData')).toBe(false);
  });
});
