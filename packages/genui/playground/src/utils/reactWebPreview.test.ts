// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unsupported-features/node-builtins -- Browser stream APIs are available in the repository's Node.js test runtime. */

import { afterEach, expect, rstest, test } from '@rstest/core';

import { loadReactWebDocument } from './reactWebPreview.js';

afterEach(() => {
  rstest.unstubAllGlobals();
});

test('downloads UTF-8 HTML without credentials or redirects', async () => {
  const html = '<!doctype html><html><body>你好</body></html>';
  const bytes = new TextEncoder().encode(html);
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }),
  );
  const fetch = rstest.fn().mockResolvedValue(response);
  rstest.stubGlobal('window', { fetch });
  const signal = new AbortController().signal;
  await expect(loadReactWebDocument('https://example.com/index.html', signal))
    .resolves.toBe(html);
  expect(fetch).toHaveBeenCalledWith('https://example.com/index.html', {
    credentials: 'omit',
    redirect: 'error',
    cache: 'force-cache',
    signal,
  });
  expect(response.body?.locked).toBe(false);
});

test.each([null, 'javascript:alert(1)', 'https://user:password@example.com/'])(
  'rejects invalid URLs before fetching (case %#)',
  async value => {
    const fetch = rstest.fn();
    rstest.stubGlobal('window', { fetch });
    await expect(loadReactWebDocument(value, new AbortController().signal))
      .rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  },
);

test.each([
  new Response('not found', { status: 404 }),
  new Response('incomplete HTML'),
  new Response('x', {
    headers: { 'content-length': String(16 * 1024 * 1024 + 1) },
  }),
])('rejects unusable responses (case %#)', async response => {
  rstest.stubGlobal('window', {
    fetch: rstest.fn().mockResolvedValue(response),
  });
  await expect(
    loadReactWebDocument(
      'https://example.com/index.html',
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(response.body?.locked).toBe(false);
});

test('cancels oversized streams even without a content-length header', async () => {
  const cancel = rstest.fn();
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024 * 1024 + 1));
      },
      cancel,
    }),
  );
  rstest.stubGlobal('window', {
    fetch: rstest.fn().mockResolvedValue(response),
  });
  await expect(
    loadReactWebDocument(
      'https://example.com/index.html',
      new AbortController().signal,
    ),
  )
    .rejects.toThrow('too large');
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(response.body?.locked).toBe(false);
});

test('preserves cancellation and releases a partially read response', async () => {
  const controller = new AbortController();
  const cancel = rstest.fn();
  const response = new Response(
    new ReadableStream({
      pull(stream) {
        stream.enqueue(new TextEncoder().encode('<!doctype html>'));
        controller.abort(new Error('Preview changed'));
      },
      cancel,
    }),
  );
  rstest.stubGlobal('window', {
    fetch: rstest.fn().mockResolvedValue(response),
  });
  await expect(
    loadReactWebDocument('https://example.com/index.html', controller.signal),
  )
    .rejects.toThrow('Preview changed');
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(response.body?.locked).toBe(false);
});
