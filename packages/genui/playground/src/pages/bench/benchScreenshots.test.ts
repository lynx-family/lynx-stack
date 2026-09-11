// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unsupported-features/node-builtins -- Browser screenshot transport uses Web APIs. */

import { expect, rstest, test } from '@rstest/core';
import { strFromU8, unzipSync } from 'fflate';

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
      ? 'screenshot/zip/upload'
      : 'screenshot/zip/url';
    const fields = {
      entry: protocol === 'lynx-xml' ? 'index.lynxml' : 'template.js',
      width: '390',
      height: '844',
      ...(protocol === 'lynx-xml'
        ? {}
        : { url: `https://assets.test/${protocol}.zip`, globalProps: '{}' }),
    };
    const bytes = new Uint8Array([66, 77, 1, 2]);
    const onError = rstest.fn();
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          path,
          fields,
          ...(protocol === 'lynx-xml' ? { source: '<lynx>杭州</lynx>' } : {}),
          timeoutMs: 1000,
        }),
      )
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
    const form = init?.body as FormData;
    expect(new Headers(init?.headers).get('Content-Type')).toBeNull();
    if (protocol === 'lynx-xml') {
      const file = form.get('file') as File;
      expect(file.type).toBe('application/zip');
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      expect(Object.keys(archive)).toEqual(['index.lynxml']);
      expect(strFromU8(archive['index.lynxml']!)).toBe('<lynx>杭州</lynx>');
      expect(form.get('source')).toBeNull();
      expect(form.get('globalProps')).toBeNull();
      form.delete('file');
    } else {
      expect(form.get('file')).toBeNull();
    }
    expect(Object.fromEntries(form.entries())).toEqual(fields);
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
      Response.json({
        path: 'screenshot/zip/upload',
        source: '<lynx/>',
        fields: { entry: 'index.lynxml' },
        timeoutMs: 1000,
      }),
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
      Response.json({
        path: 'screenshot/zip/upload',
        source: '<lynx/>',
        fields: { entry: 'index.lynxml' },
        timeoutMs: 1000,
      }),
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

test.each([
  {
    fields: { entry: 'index.lynxml', screenshotSettleMs: '1000' },
    source: '<lynx/>',
    error: 'Invalid screenshot parameter',
  },
  {
    fields: { entry: '../index.lynxml' },
    source: '<lynx/>',
    error: 'entry=index.lynxml',
  },
  {
    fields: { entry: 'index.lynxml' },
    source: '界'.repeat(3_500_000),
    error: '10 MiB',
  },
])(
  'reports invalid XML ZIP input without requesting capture: $error',
  async (input) => {
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          path: 'screenshot/zip/upload',
          ...input,
          timeoutMs: 1000,
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl,
      signal: new AbortController().signal,
      onError: rstest.fn(),
      fetch: fetchImpl,
    });
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      `${jobUrl}/screenshots/${captureId}`,
    );
    const failure = JSON.parse(
      fetchImpl.mock.calls[1]?.[1]?.body as string,
    ) as { error: string };
    expect(failure.error).toContain(input.error);
  },
);

test.each([false, true])(
  'HTML capture bypasses the sidecar and uploads pixels or capture errors: %s',
  async (fail) => {
    const captureHtml = rstest.fn().mockImplementation(() =>
      fail
        ? Promise.reject(new Error('Sharing stopped'))
        : Promise.resolve(
          new Blob([new Uint8Array([66, 77])], { type: 'image/bmp' }),
        )
    );
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          path: 'browser/html',
          fields: { width: '390', height: '844' },
          source: '<!doctype html><html><head></head><body>Hello</body></html>',
          timeoutMs: 1000,
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl: '',
      signal: new AbortController().signal,
      captureHtml,
      fetch: fetchImpl,
      onError: rstest.fn(),
    });
    relay(captureId);
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
    expect(captureHtml).toHaveBeenCalledTimes(1);
    expect(captureHtml).toHaveBeenCalledWith(
      expect.objectContaining({ width: 390, height: 844 }),
      expect.any(AbortSignal),
    );
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${jobUrl}/screenshots/${captureId}`,
      `${jobUrl}/screenshots/${captureId}`,
    ]);
    const upload = fetchImpl.mock.calls[1]![1]!;
    expect(upload.headers).toEqual({
      'Content-Type': fail ? 'application/json' : 'image/bmp',
    });
    if (fail) expect(upload.body).toContain('Sharing stopped');
  },
);
