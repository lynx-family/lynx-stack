// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Screenshot transport uses browser Web APIs. */

import { afterEach, expect, rstest, test } from '@rstest/core';

import {
  buildPreviewScreenshotSource,
  capturePreviewScreenshot,
} from './previewScreenshot.js';
import { PROTOCOLS } from './protocol.js';
import type { PreviewImageSettings } from '../components/PreviewImage.js';
import type { PreviewPanelSource } from '../components/PreviewPanel.js';

const nativeBundleUrl =
  'https://playground.test/app/a2ui.lynx.js?fullscreen=true';
const imageUrl = 'https://images.test/screenshot/page.bmp';
const settings: PreviewImageSettings = {
  endpoint: 'https://server-render.lynx-stack.dev/',
  width: 308,
  height: 600,
  screenshotSettleMs: 2000,
  timeoutMs: 30_000,
};
const xmlSource = {
  route: 'lynxml' as const,
  entry: 'index.lynxml',
  source: '<lynx><view /></lynx>',
};

afterEach(() => {
  rstest.unstubAllGlobals();
});

test('captures current A2UI data with the native bundle and no live playback bridge', () => {
  const messages = [{ createSurface: { surfaceId: 'main' } }];
  const actionMocks = { submit: [] };
  const source = buildPreviewScreenshotSource({
    kind: 'a2ui',
    protocol: PROTOCOLS.a2ui,
    demoUrl: './a2ui.web.js',
    theme: 'dark',
    messages,
    actionMocks,
    messagesUrl: 'blob:browser-only',
    liveAction: true,
    playbackMode: true,
  }, nativeBundleUrl);
  expect(source).toEqual({
    route: 'template',
    entry: 'a2ui.lynx.js',
    url: 'https://playground.test/app/a2ui.lynx.js',
    globalProps: { messages, actionMocks, theme: 'dark', instant: true },
  });
});

test('captures OpenUI text directly without a browser payload URL or playback', () => {
  expect(buildPreviewScreenshotSource({
    kind: 'openui',
    rawText: 'root = Text("Hello")',
    inlineMode: true,
    liveAction: true,
    liveStream: true,
    playbackMode: true,
  }, nativeBundleUrl)).toEqual({
    route: 'template',
    entry: 'openui.lynx.js',
    url: 'https://playground.test/app/openui.lynx.js',
    globalProps: {
      rawText: 'root = Text("Hello")',
      inlineMode: true,
      theme: 'light',
      instant: true,
    },
  });
});

test('passes MCP Apps host data to the native renderer', () => {
  const mcpAppData = { renderer: 'weather', input: { city: 'Shanghai' } };
  expect(buildPreviewScreenshotSource({
    kind: 'mcp-apps',
    mcpAppData,
    theme: 'dark',
  }, nativeBundleUrl)).toEqual({
    route: 'template',
    entry: 'mcp-apps.lynx.js',
    url: 'https://playground.test/app/mcp-apps.lynx.js',
    globalProps: { mcpAppData, theme: 'dark' },
  });
});

test('uses ReactLynx nativeUrl instead of the separately published webUrl', () => {
  expect(buildPreviewScreenshotSource({
    kind: 'reactlynx',
    webUrl: 'https://assets.test/build/main.web.js',
    nativeUrl: 'https://assets.test/build/main.lynx.js',
  }, nativeBundleUrl)).toEqual({
    route: 'template',
    entry: 'main.lynx.js',
    url: 'https://assets.test/build/main.lynx.js',
  });
});

test('captures locally edited XML instead of an older published source', () => {
  expect(buildPreviewScreenshotSource({
    kind: 'lynx-xml',
    source: xmlSource.source,
    sourcePath: 'https://assets.test/old.lynxml',
    theme: 'dark',
  }, '')).toEqual(xmlSource);
});

test.each<PreviewPanelSource | undefined>([
  undefined,
  { kind: 'html', source: '<!doctype html><html />' },
  { kind: 'reactweb', webUrl: 'https://assets.test/index.html' },
  { kind: 'placeholder', item: { title: 'Empty', description: 'No content' } },
  { kind: 'lynx-xml', source: ' ' },
  { kind: 'openui', rawText: '' },
  { kind: 'mcp-apps', mcpAppData: null },
  {
    kind: 'a2ui',
    protocol: PROTOCOLS.a2ui,
    demoUrl: './a2ui.web.js',
    theme: 'light',
    messages: [],
  },
  {
    kind: 'reactlynx',
    webUrl: 'https://assets.test/main.web.js',
    nativeUrl: '',
  },
  {
    kind: 'reactlynx',
    webUrl: 'https://assets.test/main.web.js',
    nativeUrl: 'https://assets.test/main.web.js',
  },
])(
  'has no screenshot source for unavailable or non-native previews (case %#)',
  preview => {
    expect(buildPreviewScreenshotSource(preview, nativeBundleUrl)).toBeNull();
  },
);

test.each([
  'https://playground.test/a2ui.web.js',
  'blob:browser-only',
  'https://user:password@playground.test/a2ui.lynx.js',
])('rejects non-native or credentialed renderer URLs: %s', url => {
  expect(
    buildPreviewScreenshotSource({
      kind: 'openui',
      rawText: 'root = Text("Hi")',
    }, url),
  )
    .toBeNull();
});

test('sends native multipart data with screen settings and no credentials or redirects', async () => {
  const fetch = rstest.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({ url: imageUrl }),
  );
  rstest.stubGlobal('fetch', fetch);
  const source = buildPreviewScreenshotSource({
    kind: 'openui',
    rawText: 'root = Text("Hi")',
  }, nativeBundleUrl)!;
  await expect(
    capturePreviewScreenshot(source, settings, new AbortController().signal),
  )
    .resolves.toBe(imageUrl);
  const [url, request] = fetch.mock.calls[0]!;
  expect(url).toBe('https://server-render.lynx-stack.dev/screenshot/template');
  expect(request).toMatchObject({
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
  });
  expect(request?.signal).toBeInstanceOf(AbortSignal);
  expect(Object.fromEntries((request?.body as FormData).entries())).toEqual({
    entry: 'openui.lynx.js',
    url: 'https://playground.test/app/openui.lynx.js',
    globalProps: JSON.stringify(source.globalProps),
    width: '308',
    height: '600',
    screenshotSettleMs: '2000',
    timeoutMs: '30000',
  });
});

test('preserves endpoint path prefixes, explicit zero delay, and XML source', async () => {
  const fetch = rstest.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({ url: imageUrl }),
  );
  rstest.stubGlobal('fetch', fetch);
  await capturePreviewScreenshot(xmlSource, {
    ...settings,
    endpoint: 'http://localhost:8080/render',
    screenshotSettleMs: 0,
  }, new AbortController().signal);
  const [url, request] = fetch.mock.calls[0]!;
  expect(url).toBe('http://localhost:8080/render/screenshot/lynxml');
  expect(Object.fromEntries((request?.body as FormData).entries())).toEqual({
    entry: 'index.lynxml',
    source: xmlSource.source,
    width: '308',
    height: '600',
    screenshotSettleMs: '0',
    timeoutMs: '30000',
  });
});

test.each<Partial<PreviewImageSettings>>([
  { endpoint: 'file:///tmp/capture' },
  { endpoint: 'https://user:password@capture.test' },
  { endpoint: 'https://capture.test?url=https://web.test/a2ui.web.js' },
  { endpoint: 'https://capture.test#route' },
  { width: 0 },
  { width: 8193 },
  { height: 1.5 },
  { width: 2000, height: 2000 },
  { screenshotSettleMs: -1 },
  { screenshotSettleMs: 30000 },
  { timeoutMs: 0 },
  { timeoutMs: 300001 },
])(
  'rejects invalid screenshot settings before sending (case %#)',
  async invalid => {
    const fetch = rstest.fn();
    rstest.stubGlobal('fetch', fetch);
    await expect(
      capturePreviewScreenshot(
        xmlSource,
        { ...settings, ...invalid },
        new AbortController().signal,
      ),
    )
      .rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  },
);

test.each([
  { url: 'javascript:alert(1)' },
  { url: 'https://user:password@assets.test/page.bmp' },
  { url: 'blob:browser-only' },
  { image: imageUrl },
  null,
])('rejects invalid screenshot URL responses (case %#)', async reply => {
  rstest.stubGlobal(
    'fetch',
    rstest.fn().mockResolvedValue(Response.json(reply)),
  );
  await expect(
    capturePreviewScreenshot(xmlSource, settings, new AbortController().signal),
  )
    .rejects.toThrow('invalid image URL');
});

test('shows service error messages without native child process diagnostics', async () => {
  rstest.stubGlobal(
    'fetch',
    rstest.fn().mockResolvedValue(Response.json({
      error: {
        message: 'The native template could not be downloaded.',
        stderr: 'private runtime logs',
      },
    }, { status: 502 })),
  );
  await expect(
    capturePreviewScreenshot(xmlSource, settings, new AbortController().signal),
  )
    .rejects.toThrow(
      'Screenshot service returned HTTP 502. The native template could not be downloaded.',
    );
});

test('explains network errors without requiring the user to configure a template', async () => {
  rstest.stubGlobal(
    'fetch',
    rstest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  await expect(
    capturePreviewScreenshot(xmlSource, settings, new AbortController().signal),
  )
    .rejects.toThrow('Check the endpoint, HTTPS, CORS, and network access.');
});

test('cancels a pending request when the preview changes', async () => {
  const controller = new AbortController();
  const fetch = rstest.fn<typeof globalThis.fetch>().mockImplementation(
    (_url, init) => {
      const signal = init?.signal;
      controller.abort(new Error('Preview changed'));
      signal?.throwIfAborted();
      return Promise.resolve(Response.json({ url: imageUrl }));
    },
  );
  rstest.stubGlobal('fetch', fetch);
  await expect(capturePreviewScreenshot(xmlSource, settings, controller.signal))
    .rejects.toThrow('Preview changed');
});

test('does not start a cancelled capture', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Image view closed'));
  const fetch = rstest.fn();
  rstest.stubGlobal('fetch', fetch);
  await expect(capturePreviewScreenshot(xmlSource, settings, controller.signal))
    .rejects.toThrow('Image view closed');
  expect(fetch).not.toHaveBeenCalled();
});
