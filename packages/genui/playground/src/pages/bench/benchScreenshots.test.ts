// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Browser screenshot transport uses Web APIs. */

import { expect, rstest, test } from '@rstest/core';

import {
  checkBenchScreenshotService,
  createBenchScreenshotRelay,
} from './benchScreenshots.js';

const captureId = '12345678-1234-1234-1234-123456789abc';
const jobUrl = 'https://genui.test/a2ui/bench/jobs/job';
const serverUrl = 'https://capture.test/internal/';

test('checks screenshot service health directly from the browser', async () => {
  const fetchImpl = rstest.fn<typeof fetch>().mockResolvedValue(
    Response.json({ status: 'ok' }),
  );
  await checkBenchScreenshotService(
    serverUrl,
    new AbortController().signal,
    fetchImpl,
  );
  expect((fetchImpl.mock.calls[0]?.[0] as URL).href).toBe(`${serverUrl}health`);
  expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
  });
});

test.each(['a2ui', 'openui', 'lynx-xml'])(
  'captures %s in the browser and uploads BMP, deduplicating SSE replay',
  async (protocol) => {
    const path = protocol === 'lynx-xml'
      ? 'screenshot/lynxml'
      : 'screenshot/template';
    const fields = {
      entry: protocol === 'lynx-xml' ? 'index.lynxml' : 'template.js',
      width: '390',
      height: '844',
      ...(protocol === 'lynx-xml'
        ? { source: '<lynx/>' }
        : { url: `https://assets.test/${protocol}.js`, globalProps: '{}' }),
    };
    const bytes = new Uint8Array([66, 77, 1, 2]);
    const onError = rstest.fn();
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ path, fields, timeoutMs: 1000 }))
      .mockResolvedValueOnce(
        new Response(bytes, { headers: { 'Content-Type': 'image/bmp' } }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl,
      signal: new AbortController().signal,
      onError,
      fetch: fetchImpl,
    });
    relay(captureId);
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(3);
    expect((fetchImpl.mock.calls[1]?.[0] as URL).href).toBe(
      `${serverUrl}${path}`,
    );
    const init = fetchImpl.mock.calls[1]?.[1];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(Object.fromEntries((init?.body as FormData).entries())).toEqual(
      fields,
    );
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error' });
    const upload = fetchImpl.mock.calls[2];
    expect(upload?.[0]).toBe(`${jobUrl}/screenshots/${captureId}`);
    expect(upload?.[1]?.headers).toEqual({ 'Content-Type': 'image/bmp' });
    expect(new Uint8Array(await (upload?.[1]?.body as Blob).arrayBuffer()))
      .toEqual(bytes);
    expect(onError).not.toHaveBeenCalled();
  },
);

test('uploads capture failures so the server can finish the failed run', async () => {
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ path: 'screenshot/lynxml', fields: {}, timeoutMs: 1000 }),
    )
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    signal: new AbortController().signal,
    onError: rstest.fn(),
    fetch: fetchImpl,
  });
  relay(captureId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(3);
  expect(JSON.parse(fetchImpl.mock.calls[2]?.[1]?.body as string)).toEqual({
    error: 'Browser screenshot failed: Failed to fetch',
  });
});

test('retries upload without recapturing and ignores work after cancellation', async () => {
  const controller = new AbortController();
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ path: 'screenshot/lynxml', fields: {}, timeoutMs: 1000 }),
    )
    .mockResolvedValueOnce(
      new Response('BM', { headers: { 'Content-Type': 'image/bmp' } }),
    )
    .mockRejectedValueOnce(new TypeError('Lost upload acknowledgement'))
    .mockResolvedValueOnce(new Response(null, { status: 409 }));
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    signal: controller.signal,
    onError: rstest.fn(),
    fetch: fetchImpl,
  });
  relay(captureId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(4);
  expect(fetchImpl.mock.calls[3]?.[1]?.body).toBe(
    fetchImpl.mock.calls[2]?.[1]?.body,
  );
  controller.abort();
  relay('22345678-1234-1234-1234-123456789abc');
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});
