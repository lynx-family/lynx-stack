// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Hono } from 'hono';

import { getBenchJobStore } from '../../../../../../service/common/bench/store.js';
import { jsonWithCors } from '../../../../../common/cors.js';

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024 + 1024;
const route = new Hono();

route.get('/:jobId/screenshots/:captureId', (context) => {
  const request = getBenchJobStore().startScreenshot(
    context.req.param('jobId'),
    context.req.param('captureId'),
  );
  return request
    ? jsonWithCors(context.req.raw, request, {
      headers: { 'Cache-Control': 'no-store' },
    })
    : jsonWithCors(context.req.raw, {
      error: 'Screenshot task is no longer pending.',
    }, { status: 404 });
});

route.post('/:jobId/screenshots/:captureId', async (context) => {
  const store = getBenchJobStore();
  const jobId = context.req.param('jobId');
  const captureId = context.req.param('captureId');
  const req = context.req.raw;
  if (!store.getScreenshotRequest(jobId, captureId)) {
    return jsonWithCors(
      req,
      { error: 'Screenshot task is no longer pending.' },
      { status: 409 },
    );
  }
  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim();
  if (contentType !== 'image/bmp' && contentType !== 'application/json') {
    return jsonWithCors(req, {
      error: 'Upload an image/bmp screenshot or a JSON capture error.',
    }, { status: 415 });
  }
  const limit = contentType === 'image/bmp' ? MAX_SCREENSHOT_BYTES : 4096;
  if (Number(req.headers.get('content-length')) > limit) {
    await req.body?.cancel().catch(() => undefined);
    return jsonWithCors(req, { error: 'Screenshot upload is too large.' }, {
      status: 413,
    });
  }
  const reader = req.body?.getReader();
  if (!reader) {
    return jsonWithCors(req, { error: 'Missing screenshot upload.' }, {
      status: 400,
    });
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const timeout = AbortSignal.timeout(30_000);
  const signal = AbortSignal.any([
    req.signal,
    timeout,
    store.getJob(jobId)!.abortController.signal,
  ]);
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        return jsonWithCors(req, { error: 'Screenshot upload is too large.' }, {
          status: 413,
        });
      }
      chunks.push(chunk.value);
    }
    signal.throwIfAborted();
    const body = Buffer.concat(chunks);
    let response: Response;
    if (contentType === 'application/json') {
      const value = JSON.parse(body.toString('utf8')) as { error?: unknown };
      if (typeof value?.error !== 'string' || !value.error.trim()) {
        return jsonWithCors(req, { error: 'Missing capture error.' }, {
          status: 400,
        });
      }
      response = Response.json({ error: value.error.slice(0, 2000) }, {
        status: 502,
      });
    } else {
      // Full pixel-layout validation occurs before PNG conversion and scoring.
      response = new Response(body, {
        headers: { 'Content-Type': 'image/bmp' },
      });
    }
    const accepted = store.submitScreenshot(jobId, captureId, response);
    return jsonWithCors(req, { ok: accepted }, {
      status: accepted ? 200 : 409,
    });
  } catch {
    return jsonWithCors(req, {
      error: 'Invalid or interrupted screenshot upload.',
    }, { status: 400 });
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
});

export default route;
