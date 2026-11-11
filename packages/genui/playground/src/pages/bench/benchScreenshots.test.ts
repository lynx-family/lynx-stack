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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const screenshotUrl = 'https://assets.test/screenshot/6f1c/screenshot.bmp';

/** UI Judge answers with the public URL of the BMP it uploaded. */
function uploadedScreenshot() {
  return Response.json({ url: screenshotUrl });
}

/** The BMP as object storage serves it. */
function storedBmp(bytes: BodyInit = 'BM') {
  return new Response(bytes, { headers: { 'Content-Type': 'image/bmp' } });
}

function xmlTask() {
  return Response.json({
    path: 'screenshot/zip/upload',
    source: '<lynx/>',
    fields: { entry: 'index.lynxml' },
    timeoutMs: 1000,
  });
}

test('queues announced IDs immediately but fetches and captures only after the previous upload settles', async () => {
  const nextId = '22345678-1234-1234-1234-123456789abc';
  const captured = deferred<Response>();
  const uploaded = deferred<Response>();
  const onError = rstest.fn();
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockResolvedValueOnce(xmlTask())
    .mockImplementationOnce(() => captured.promise)
    .mockResolvedValueOnce(storedBmp())
    .mockImplementationOnce(() => uploaded.promise)
    .mockResolvedValueOnce(xmlTask())
    .mockResolvedValueOnce(uploadedScreenshot())
    .mockResolvedValueOnce(storedBmp())
    .mockResolvedValueOnce(Response.json({ ok: true }));
  const controller = new AbortController();
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    signal: controller.signal,
    onError,
    fetch: fetchImpl,
  });
  relay(captureId);
  relay(nextId);
  relay(nextId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
  expect(
    fetchImpl.mock.calls.some(([url]) =>
      url === `${jobUrl}/screenshots/${nextId}`
    ),
  ).toBe(false);
  captured.resolve(uploadedScreenshot());
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(4);
  expect(fetchImpl.mock.calls[2]?.[0]).toBe(screenshotUrl);
  expect(fetchImpl.mock.calls[3]?.[1]?.method).toBe('POST');
  uploaded.resolve(Response.json({ ok: true }));
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(8);
  expect(fetchImpl.mock.calls[4]?.[0]).toBe(`${jobUrl}/screenshots/${nextId}`);
  relay(captureId);
  relay(nextId);
  expect(fetchImpl).toHaveBeenCalledTimes(8);
  expect(onError).not.toHaveBeenCalled();
  controller.abort();
});

test('cancellation aborts the active capture and discards queued IDs without fetching them', async () => {
  const nextId = '22345678-1234-1234-1234-123456789abc';
  let captureSignal: AbortSignal | undefined;
  const onError = rstest.fn();
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockResolvedValueOnce(xmlTask())
    .mockImplementationOnce((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        captureSignal = init!.signal!;
        captureSignal.addEventListener(
          'abort',
          () => reject(new Error('Capture cancelled')),
          { once: true },
        );
      })
    );
  const controller = new AbortController();
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    signal: controller.signal,
    onError,
    fetch: fetchImpl,
  });
  relay(captureId);
  relay(nextId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
  controller.abort();
  await expect.poll(() => captureSignal?.aborted).toBe(true);
  relay(nextId);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(onError).not.toHaveBeenCalled();
});

test('a failed task fetch does not block later IDs and can be retried after SSE replay', async () => {
  const nextId = '22345678-1234-1234-1234-123456789abc';
  const onError = rstest.fn();
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const controller = new AbortController();
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    signal: controller.signal,
    onError,
    fetch: fetchImpl,
  });
  relay(captureId);
  relay(nextId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
  expect(fetchImpl.mock.calls[1]?.[0]).toBe(`${jobUrl}/screenshots/${nextId}`);
  relay(captureId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(3);
  expect(fetchImpl.mock.calls[2]?.[0]).toBe(
    `${jobUrl}/screenshots/${captureId}`,
  );
  expect(onError).toHaveBeenCalledExactlyOnceWith('Failed to fetch');
  controller.abort();
});

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

test.each(
  ['a2ui', 'openui', 'lynx-xml'].flatMap(protocol =>
    [undefined, 0, 3000].map(screenshotSettleMs => ({
      protocol,
      screenshotSettleMs,
    }))
  ),
)(
  'captures $protocol with delay $screenshotSettleMs and deduplicates SSE replay',
  async ({ protocol, screenshotSettleMs }) => {
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
      .mockResolvedValueOnce(uploadedScreenshot())
      .mockResolvedValueOnce(storedBmp(bytes))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl,
      screenshotSettleMs,
      signal: new AbortController().signal,
      onError,
      fetch: fetchImpl,
    });
    relay(captureId);
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(4);
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
    expect(Object.fromEntries(form.entries())).toEqual({
      ...fields,
      screenshotSettleMs: String(screenshotSettleMs ?? 100),
    });
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error' });
    const download = fetchImpl.mock.calls[2];
    expect(download?.[0]).toBe(screenshotUrl);
    expect(download?.[1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
    });
    expect(download?.[1]?.method).toBeUndefined();
    const upload = fetchImpl.mock.calls[3];
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
    .mockResolvedValueOnce(uploadedScreenshot())
    .mockResolvedValueOnce(storedBmp())
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
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(5);
  expect(fetchImpl.mock.calls[4]?.[1]?.body).toBe(
    fetchImpl.mock.calls[3]?.[1]?.body,
  );
  controller.abort();
  relay('22345678-1234-1234-1234-123456789abc');
  expect(fetchImpl).toHaveBeenCalledTimes(5);
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

test.each(
  [false, true].flatMap(fail =>
    [undefined, 0, 3000].map(screenshotSettleMs => ({
      fail,
      screenshotSettleMs,
    }))
  ),
)(
  'HTML/ReactWeb capture forwards delay $screenshotSettleMs without a sidecar (failure: $fail)',
  async ({ fail, screenshotSettleMs }) => {
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
      screenshotSettleMs,
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
      expect.objectContaining({
        width: 390,
        height: 844,
        screenshotSettleMs: screenshotSettleMs ?? 100,
      }),
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

test.each([
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
].flatMap(screenshotSettleMs =>
  ['screenshot/zip/upload', 'browser/html'].map(path => ({
    path,
    screenshotSettleMs,
  }))
))(
  'rejects invalid delay $screenshotSettleMs before $path capture',
  async ({ screenshotSettleMs, path }) => {
    const captureHtml = rstest.fn();
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(
        path === 'browser/html'
          ? Response.json({
            path,
            fields: { width: '390', height: '844' },
            source: '<!doctype html><html></html>',
            timeoutMs: 1000,
          })
          : xmlTask(),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl,
      screenshotSettleMs,
      captureHtml,
      signal: new AbortController().signal,
      onError: rstest.fn(),
      fetch: fetchImpl,
    });
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      `${jobUrl}/screenshots/${captureId}`,
    );
    expect(fetchImpl.mock.calls[1]?.[1]?.body)
      .toContain('Screenshot delay must be a non-negative integer');
    expect(captureHtml).not.toHaveBeenCalled();
  },
);

test('captures the published ReactLynx ZIP by URL without sending binary assets', async () => {
  const zipUrl = 'https://cdn.test/reactlynx-bench/preview/id/bundle.zip';
  const fetchImpl = rstest.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({
      path: 'screenshot/zip/url',
      fields: {
        entry: 'main.lynx.js',
        url: zipUrl,
        width: '390',
        height: '844',
      },
      timeoutMs: 1000,
    }))
    .mockResolvedValueOnce(uploadedScreenshot())
    .mockResolvedValueOnce(storedBmp())
    .mockResolvedValueOnce(Response.json({ ok: true }));
  const relay = createBenchScreenshotRelay({
    jobUrl,
    serverUrl,
    screenshotSettleMs: 0,
    signal: new AbortController().signal,
    onError: rstest.fn(),
    fetch: fetchImpl,
  });
  relay(captureId);
  relay(captureId);
  await expect.poll(() => fetchImpl.mock.calls.length).toBe(4);
  expect(fetchImpl.mock.calls[1]?.[0]).toEqual(
    new URL('screenshot/zip/url', serverUrl),
  );
  const form = fetchImpl.mock.calls[1]?.[1]?.body as FormData;
  expect(form.get('entry')).toBe('main.lynx.js');
  expect(form.get('url')).toBe(zipUrl);
  expect(form.get('screenshotSettleMs')).toBe('0');
  expect([...form.keys()].sort()).toEqual([
    'entry',
    'height',
    'screenshotSettleMs',
    'url',
    'width',
  ]);
  expect(fetchImpl.mock.calls[2]?.[0]).toBe(screenshotUrl);
  expect(fetchImpl.mock.calls[3]?.[1]?.headers).toEqual({
    'Content-Type': 'image/bmp',
  });
});

test.each([
  {
    name: 'a bare BMP',
    reply: () => storedBmp(),
    error: 'did not return a screenshot URL',
  },
  {
    name: 'invalid JSON',
    reply: () =>
      new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    error: 'invalid screenshot URL',
  },
  { name: 'no URL', reply: () => Response.json({}), error: 'invalid' },
  {
    name: 'a non-string URL',
    reply: () => Response.json({ url: 5 }),
    error: 'invalid',
  },
  {
    name: 'a relative URL',
    reply: () => Response.json({ url: '/screenshot.bmp' }),
    error: 'invalid',
  },
  {
    name: 'a non-HTTP(S) URL',
    reply: () => Response.json({ url: 'ftp://assets.test/screenshot.bmp' }),
    error: 'invalid',
  },
  {
    name: 'a URL with credentials',
    reply: () =>
      Response.json({ url: 'https://user:pass@assets.test/screenshot.bmp' }),
    error: 'invalid',
  },
  {
    name: 'an oversized body',
    reply: () =>
      Response.json({ url: `https://assets.test/${'a'.repeat(5000)}` }),
    error: 'oversized',
  },
])(
  'uploads a capture failure when the screenshot service returns $name',
  async ({ reply, error }) => {
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(xmlTask())
      .mockResolvedValueOnce(reply())
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
    // Nothing is downloaded unless the reply names a safe URL.
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(
      `${jobUrl}/screenshots/${captureId}`,
    );
    const failure = JSON.parse(
      fetchImpl.mock.calls[2]?.[1]?.body as string,
    ) as { error: string };
    expect(failure.error).toContain('Browser screenshot failed:');
    expect(failure.error).toContain(error);
  },
);

test.each([
  {
    name: 'an HTTP error',
    image: () => new Response('denied', { status: 403 }),
    error: 'Screenshot download returned HTTP 403',
  },
  {
    name: 'a non-BMP content type',
    image: () =>
      new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
    error: 'not a BMP image',
  },
  {
    name: 'an oversized object',
    image: () =>
      new Response('BM', {
        headers: {
          'Content-Type': 'image/bmp',
          'Content-Length': String(10 * 1024 * 1024 + 2048),
        },
      }),
    error: 'exceeds the upload size limit',
  },
  {
    name: 'a network error',
    image: (): Response => {
      throw new TypeError('Failed to fetch');
    },
    error: 'Failed to fetch',
  },
])(
  'uploads a capture failure when the stored screenshot download fails with $name',
  async ({ image, error }) => {
    const fetchImpl = rstest.fn<typeof fetch>()
      .mockResolvedValueOnce(xmlTask())
      .mockResolvedValueOnce(uploadedScreenshot())
      .mockImplementationOnce(() => Promise.resolve().then(image))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const relay = createBenchScreenshotRelay({
      jobUrl,
      serverUrl,
      signal: new AbortController().signal,
      onError: rstest.fn(),
      fetch: fetchImpl,
    });
    relay(captureId);
    await expect.poll(() => fetchImpl.mock.calls.length).toBe(4);
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(screenshotUrl);
    expect(fetchImpl.mock.calls[3]?.[1]?.headers).toEqual({
      'Content-Type': 'application/json',
    });
    const failure = JSON.parse(
      fetchImpl.mock.calls[3]?.[1]?.body as string,
    ) as { error: string };
    expect(failure.error).toContain(error);
  },
);
